import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { runPolling } from '@/supabase/functions/_shared/polling.mjs';
import { captureRankingSnapshotForRoster } from '@/lib/rankingSnapshot';
import { buildRoundSheet } from '@/lib/roundSheetData';
import { formatManualPollMessage, sendDiscord } from '@/supabase/functions/_shared/notify.mjs';
import { toKstDate } from '@/supabase/functions/_shared/sessions.mjs';

// 디스코드 알림은 폴링의 곁다리다 — 웹훅이 없거나 전송이 실패해도 폴링 응답
// 자체는 정상으로 돌려준다. 알림 때문에 버튼이 실패로 보이면 안 된다.
async function notifyPollDone(args: {
  scrimDate: string;
  /** 이번 폴링으로 새로 기록된 라운드 번호들. 보통 하나지만 늦게 누르면 여럿이다. */
  roundNumbers: number[];
  attempt: number;
  pressedAt: string;
  pollingMs: number;
  persistMs: number;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const finishedAt = new Date().toISOString();
  for (const roundNo of args.roundNumbers) {
    try {
      await sendDiscord(webhookUrl, formatManualPollMessage({ ...args, roundNo, finishedAt }));
    } catch {
      // 알림 실패는 조용히 넘긴다.
    }
  }
}

// 등수 스냅샷 캡처는 이 로스터가 참여한 내전 세션의 라운드가 몇 개나 기록됐는지
// 봐야 한다. 시트가 세는 것과 반드시 같아야 하므로(어긋나면 "폴링해서 라운드가
// 늘었다"고 판단해 놓고 시트는 그대로인 상태가 된다) 같은 함수를 쓴다.
async function countRoundsForRoster(supabase: SupabaseClient, rosterId: string): Promise<number> {
  try {
    return (await buildRoundSheet(supabase, rosterId)).roundCount;
  } catch {
    return 0;
  }
}

// 03 내전 시트의 "폴링" 버튼 — 방금 끝난 매치 하나를 잡으러 짧은 시간창으로
// 기존 폴링 파이프라인을 그대로 호출한다(재구현 없음). 아직 PUBG 서버에 안
// 올라왔으면(너무 빨리 누름) scrimsFound: 0 이 정상 응답이다 — 에러 아니다.
export async function POST(request: Request) {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PUBG_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;
  // 버튼을 누른 시각과 몇 번째 시도인지는 클라이언트만 안다 — 한 번 눌러두면
  // 매치가 잡힐 때까지 이 라우트를 여러 번 두드리기 때문이다.
  const pressedAt = typeof body.pressedAt === 'string' ? body.pressedAt : null;
  const attempt = typeof body.attempt === 'number' ? body.attempt : 1;

  try {
    const supabase = getSupabaseServer();

    // rosterId가 있으면 이번 내전 참가자가 이미 확정돼 있다(01/02/03을 거침) —
    // 후보 30명을 훑는 대신 1번팀 1티어 한 명만 고정 씨앗으로 써서 API 호출을
    // 줄인다. 팀 배정은 02에서 나서야 정해지므로 이 사람이 누군지는 03 시트에
    // 들어오기 전까진 알 수 없다 — 그래서 매번 이 자리에서 다시 조회한다.
    // 그 자리가 비었거나(수동 추가한 사람이라 member_id가 없다든지) PUBG 계정이
    // 없으면 아예 못 찾은 채로 넘어가고, runPolling이 기존 방식으로 대체한다.
    let knownAccountId: string | null = null;
    if (rosterId) {
      const { data: entryRow } = await supabase
        .from('scrim_roster_entries')
        .select('members(member_pubg_accounts(pubg_account_id))')
        .eq('roster_id', rosterId)
        .eq('team_number', 1)
        .eq('tier_slot', 1)
        .not('member_id', 'is', null)
        .maybeSingle();

      const members = entryRow?.members as unknown as
        | { member_pubg_accounts: { pubg_account_id: string | null }[] }
        | null;
      knownAccountId = members?.member_pubg_accounts.find((a) => a.pubg_account_id)?.pubg_account_id ?? null;
    }

    const pollingStartedAt = Date.now();
    const result = await runPolling({
      supabase,
      apiKey,
      sinceHours: 3,
      maxMatches: 50,
      playerRetries: 2,
      knownAccountId,
    });
    const pollingMs = Date.now() - pollingStartedAt;
    const persistStartedAt = Date.now();

    // 등수 스냅샷 캡처·리더보드 갱신은 폴링의 본 목적(매치 기록)에 딸린 부수
    // 효과다 — 실패해도 폴링 응답 자체는 정상으로 돌려준다(사용자는 "폴링
    // 성공"만 신경 쓴다). 이미 캡처됐으면 captureRankingSnapshotForRoster가
    // 알아서 아무것도 안 하므로, 여러 번 폴링해도 안전하다.
    //
    // 리더보드(app/dashboard/page.tsx)는 revalidate:false 라 시간이 지나도
    // 저절로 안 바뀐다 — 딱 여기, 이 세션의 라운드 4개가 처음 확인된 순간에만
    // revalidatePath 로 갱신한다. 1~3매치만 폴링된 상태로는 리더보드 화면이
    // 전혀 안 바뀌어야 등수 변동(4매치 확인 후 스냅샷)과 타이밍이 맞는다.
    let roundCount = 0;
    if (rosterId) {
      roundCount = await countRoundsForRoster(supabase, rosterId);
      if (roundCount >= 4) {
        await captureRankingSnapshotForRoster(supabase, rosterId).catch(() => {});
        revalidatePath('/dashboard');
      }
    }

    // 매치를 실제로 잡았을 때만 알린다 — 한 번 눌러두면 잡힐 때까지 수십 번
    // 두드리므로, 못 잡은 시도까지 보내면 알림이 무뎌진다.
    if (result.scrimsFound > 0 && pressedAt) {
      // 라운드 하나에 알림 하나다. 이번에 몇 라운드가 새로 들어왔는지는
      // scrimsFound 가 알려주고(polled_matches 덕에 같은 매치는 두 번 안 센다),
      // 그게 몇 번째 라운드인지는 지금 세어둔 총 라운드 수에서 거꾸로 구한다.
      const firstNewRound = Math.max(1, roundCount - result.scrimsFound + 1);
      await notifyPollDone({
        scrimDate: toKstDate(result.scrims[0]?.playedAt ?? new Date().toISOString()),
        roundNumbers: Array.from(
          { length: Math.min(result.scrimsFound, roundCount) },
          (_, i) => firstNewRound + i,
        ),
        attempt,
        pressedAt,
        pollingMs,
        persistMs: Date.now() - persistStartedAt,
      });
    }

    return NextResponse.json({ found: result.scrimsFound > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
