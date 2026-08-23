import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { runPolling } from '@/supabase/functions/_shared/polling.mjs';
import { captureRankingSnapshotForRoster } from '@/lib/rankingSnapshot';

const KST_OFFSET_MS = 9 * 3600 * 1000;

// app/api/scrim-roster/round-sheet/route.ts 의 toKstDate() 와 같은 규칙이다 —
// 그 파일 주석대로 공용 모듈로 뺄 만큼 크지 않아 짧게 다시 쓴다.
function toKstDate(isoTimestamp: string): string {
  const kst = new Date(new Date(isoTimestamp).getTime() + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

// 등수 스냅샷 캡처는 이 로스터가 참여한 내전 세션의 라운드가 몇 개나 기록됐는지
// 봐야 하므로, round-sheet GET 라우트와 같은 방식으로 세션/매치 수를 센다.
async function countRoundsForRoster(supabase: SupabaseClient, rosterId: string): Promise<number> {
  const { data: rosterRow } = await supabase
    .from('scrim_rosters')
    .select('fetched_at')
    .eq('id', rosterId)
    .maybeSingle();
  if (!rosterRow) return 0;

  const { data: session } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('scrim_date', toKstDate(rosterRow.fetched_at as string))
    .maybeSingle();
  if (!session) return 0;

  const { count } = await supabase
    .from('matches')
    .select('pubg_match_id', { count: 'exact', head: true })
    .eq('scrim_session_id', session.id);
  return count ?? 0;
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

    const result = await runPolling({
      supabase,
      apiKey,
      sinceHours: 3,
      maxMatches: 50,
      playerRetries: 2,
      knownAccountId,
    });

    // 등수 스냅샷 캡처·리더보드 갱신은 폴링의 본 목적(매치 기록)에 딸린 부수
    // 효과다 — 실패해도 폴링 응답 자체는 정상으로 돌려준다(사용자는 "폴링
    // 성공"만 신경 쓴다). 이미 캡처됐으면 captureRankingSnapshotForRoster가
    // 알아서 아무것도 안 하므로, 여러 번 폴링해도 안전하다.
    //
    // 리더보드(app/dashboard/page.tsx)는 revalidate:false 라 시간이 지나도
    // 저절로 안 바뀐다 — 딱 여기, 이 세션의 라운드 4개가 처음 확인된 순간에만
    // revalidatePath 로 갱신한다. 1~3매치만 폴링된 상태로는 리더보드 화면이
    // 전혀 안 바뀌어야 등수 변동(4매치 확인 후 스냅샷)과 타이밍이 맞는다.
    if (rosterId) {
      const roundCount = await countRoundsForRoster(supabase, rosterId);
      if (roundCount >= 4) {
        await captureRankingSnapshotForRoster(supabase, rosterId).catch(() => {});
        revalidatePath('/dashboard');
      }
    }

    return NextResponse.json({ found: result.scrimsFound > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
