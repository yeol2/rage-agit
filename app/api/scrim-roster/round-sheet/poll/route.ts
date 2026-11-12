import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { runPolling } from '@/supabase/functions/_shared/polling.mjs';
import { revalidateRecordPages } from '@/lib/revalidateRecordPages';
import { buildRoundSheet } from '@/lib/roundSheetData';
import {
  formatManualPollMessage,
  formatUnlinkedPlayersMessage,
  sendDiscord,
} from '@/supabase/functions/_shared/notify.mjs';
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

// 등수 스냅샷 캡처는 그 내전의 라운드가 몇 개나 기록됐는지 봐야 한다. 시트가
// 세는 것과 반드시 같아야 하므로(어긋나면 "폴링해서 라운드가 늘었다"고 판단해
// 놓고 시트는 그대로인 상태가 된다) 같은 함수를 쓴다.
async function countRounds(supabase: SupabaseClient, scrimDate: string): Promise<number> {
  try {
    return (await buildRoundSheet(supabase, scrimDate)).roundCount;
  } catch {
    return 0;
  }
}

/**
 * 이 로스터를 올린 시각. 한국시간 날짜로 바꾸면 곧 그 내전 날짜다 — 명단을 올린
 * 저녁이 그 내전이다. 폴링을 어디서부터 볼지(sinceHoursFromRoster)도 이 시각으로 정한다.
 *
 * 날짜는 폴링이 매치를 못 잡았을 때 "몇 라운드까지 왔나"를 셀 기준이다. 예전엔 그
 * 자리에 latestScrimDate(= DB 에서 가장 최근 내전)를 썼는데, 그것이 등수 변동을
 * 한 내전씩 밀리게 만든 원인이었다.
 *
 * 내전이 막 끝나고 버튼을 처음 누르면 PUBG 서버에 아직 안 올라와 있어 아무것도
 * 못 잡는다. 그 순간 오늘 세션은 DB 에 아직 없으므로 latestScrimDate 는 **지난
 * 내전**을 내놓고, 지난 내전은 당연히 4라운드가 다 차 있으니 roundCount >= 4 가
 * 통과해서 스냅샷이 그 자리에서 찍혀 버렸다 — 오늘 경기가 한 판도 안 들어온
 * 시점에. 2026-09-03 은 20:35:08 에 캡처되고 1라운드는 20:36:25 에 들어왔다.
 *
 * 로스터의 날짜로 세면 그 순간 오늘 라운드는 0개라 캡처가 안 된다. 4번째가
 * 다른 경로(CLI 폴링 등)로 먼저 들어간 뒤 버튼을 누른 경우를 구제하려던 원래
 * 의도는 그대로다 — 그때도 오늘 날짜를 세어 4가 나온다.
 */
async function rosterFetchedAt(
  supabase: SupabaseClient,
  rosterId: string | null,
): Promise<string | null> {
  if (!rosterId) return null;
  const { data } = await supabase
    .from('scrim_rosters')
    .select('fetched_at')
    .eq('id', rosterId)
    .maybeSingle();
  return (data?.fetched_at as string | undefined) ?? null;
}

const MIN_SINCE_HOURS = 3;
// PUBG 는 매치를 14일만 보관한다 — 그보다 멀리 볼 이유가 없다.
const MAX_SINCE_HOURS = 14 * 24;

/**
 * 폴링이 얼마나 되돌아볼지 — 이 로스터를 올린 시각부터다.
 *
 * 예전엔 고정 3시간이었다. 2026-10-15 내전은 20:01~21:41 에 4라운드를 치렀는데
 * 버튼이 그날 밤 00:03 에야 처음 성공했고, 그때 3시간 기준(21:03)보다 이른
 * 1·2라운드는 아예 보지도 않고 지나갔다. 명단은 내전 직전에 올리므로 그 시각부터
 * 보면 늦게 눌러도 그날 라운드를 다 잡는다. 이미 본 매치는 polled_matches 가
 * 걸러내므로 기간이 길어도 PUBG 호출은 늘지 않는다.
 *
 * 로스터를 모르면 예전처럼 3시간. 막 올린 로스터라도 3시간보다 짧게 보지는 않는다.
 */
function sinceHoursFromRoster(fetchedAt: string | null): number {
  if (!fetchedAt) return MIN_SINCE_HOURS;
  const hours = (Date.now() - new Date(fetchedAt).getTime()) / 3600_000;
  if (!Number.isFinite(hours)) return MIN_SINCE_HOURS;
  return Math.min(MAX_SINCE_HOURS, Math.max(MIN_SINCE_HOURS, hours));
}

/**
 * 그 내전에서 아직 클랜원과 안 묶인 참가자를 한 번만 알린다.
 *
 * 라운드가 다 찬 시점에만 부른다 — 라운드마다 부르면 같은 사람 이름이 네 번
 * 오고, 1라운드에 안 묶였다가 중간에 묶어준 경우 이미 해결된 걸 또 알린다.
 *
 * 스냅샷 캡처와 같은 자리라 같은 조건으로 딱 한 번 돈다.
 */
async function notifyUnlinkedPlayers(
  supabase: SupabaseClient,
  scrimDate: string,
  rosterId: string | null,
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const { data: session } = await supabase
      .from('scrim_sessions')
      .select('id')
      .eq('scrim_date', scrimDate)
      .maybeSingle();
    if (!session) return;

    const { data: matchRows } = await supabase
      .from('countable_matches')
      .select('pubg_match_id')
      .eq('scrim_session_id', session.id);
    const matchIds = (matchRows ?? []).map((row) => row.pubg_match_id as string);
    if (matchIds.length === 0) return;

    const { data: rows } = await supabase
      .from('match_participants')
      .select('pubg_ign, member_id')
      .in('pubg_match_id', matchIds);
    if (!rows || rows.length === 0) return;

    const accounts = [
      ...new Set(rows.filter((row) => !row.member_id).map((row) => row.pubg_ign as string)),
    ].sort();
    if (accounts.length === 0) return;

    // 안 묶인 계정이 "누구의 것인지"는 명단에서 구한다 — 명단에 올렸는데 그날
    // 기록이 하나도 없는 사람이 곧 그 계정의 주인이다. 본계정으로 안 뛰었으니
    // 기록이 없는 것이고, 명단에는 팀 번호와 티어 칸이 이미 적혀 있다.
    //
    // 같은 팀 팀원들의 티어에서 빈 칸을 역산하는 방법도 써봤는데 못 쓴다 —
    // 한 팀에 3티어가 둘(3.0/3.5) 들어가는 일이 흔해서 칸이 안 좁혀진다.
    // 2026-11-05 내전에서 4명 중 1명만 맞혔다.
    const playedMemberIds = new Set(
      rows.filter((row) => row.member_id).map((row) => row.member_id as string),
    );
    const { data: rosterRows } = await supabase
      .from('scrim_roster_entries')
      .select('discord_nickname, tier_slot, team_number, member_id, roster_id')
      .eq('roster_id', rosterId ?? '')
      .not('member_id', 'is', null);

    const players = (rosterRows ?? [])
      .filter((row) => !playedMemberIds.has(row.member_id as string))
      .map((row) => ({
        ign: row.discord_nickname as string,
        teamNumber: row.team_number as number | null,
        tierSlot: row.tier_slot as 1 | 2 | 3 | 4 | null,
      }))
      .sort((a, b) => (a.teamNumber ?? 99) - (b.teamNumber ?? 99) || (a.tierSlot ?? 9) - (b.tierSlot ?? 9));

    await sendDiscord(
      webhookUrl,
      // 명단에서 주인을 못 찾으면(명단 미업로드 등) PUBG 닉만이라도 알린다.
      players.length > 0
        ? formatUnlinkedPlayersMessage({ scrimDate, players, accounts })
        : formatUnlinkedPlayersMessage({ scrimDate, players: accounts }),
    );
  } catch {
    // 알림 실패는 조용히 넘긴다 — 폴링 응답에는 영향을 주지 않는다.
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
    // 후보 30명을 훑는 대신 1번팀에서 한 명만 고정 씨앗으로 써서 API 호출을
    // 줄인다. 팀 배정은 02에서 나서야 정해지므로 이 사람이 누군지는 03 시트에
    // 들어오기 전까진 알 수 없다 — 그래서 매번 이 자리에서 다시 조회한다.
    // 그 자리가 비었거나(수동 추가한 사람이라 member_id가 없다든지) PUBG 계정이
    // 없으면 아예 못 찾은 채로 넘어가고, runPolling이 기존 방식으로 대체한다.
    //
    // 씨앗은 1티어(슬롯1)가 아니라 2티어(슬롯2) 자리다. 슬롯1 에 있던 사람이
    // 안 쓰는 부계정(Ez_ClanMozip, 최근 매치 0건)을 갖고 있었고 아래 find 가
    // 하필 그걸 골라서, 폴링이 계속 빈손으로 돌아왔다.
    const SEED_TIER_SLOT = 2;
    let knownAccountId: string | null = null;
    if (rosterId) {
      const { data: entryRow } = await supabase
        .from('scrim_roster_entries')
        .select('members(member_pubg_accounts(pubg_account_id))')
        .eq('roster_id', rosterId)
        .eq('team_number', 1)
        .eq('tier_slot', SEED_TIER_SLOT)
        .not('member_id', 'is', null)
        .maybeSingle();

      const members = entryRow?.members as unknown as
        | { member_pubg_accounts: { pubg_account_id: string | null }[] }
        | null;
      knownAccountId = members?.member_pubg_accounts.find((a) => a.pubg_account_id)?.pubg_account_id ?? null;
    }

    const fetchedAt = await rosterFetchedAt(supabase, rosterId).catch(() => null);

    const pollingStartedAt = Date.now();
    const result = await runPolling({
      supabase,
      apiKey,
      sinceHours: sinceHoursFromRoster(fetchedAt),
      maxMatches: 50,
      playerRetries: 2,
      knownAccountId,
    });
    const pollingMs = Date.now() - pollingStartedAt;
    const persistStartedAt = Date.now();

    // 리더보드·등수 변동 스냅샷은 여기서 건드리지 않는다. 지표는 "우승 확정"을
    // 누른 내전만 세므로(0047) 폴링 시점에는 랭킹 숫자가 움직이지 않는다 —
    // 스냅샷 캡처와 리더보드 갱신은 confirm-win 이 한다.
    //
    // 라운드 수는 시트와 같은 기준(날짜)으로 센다. 이번에 매치를 잡았으면 그
    // 매치의 날짜를, 못 잡았으면 이 로스터의 날짜를 쓴다. 여기서 "가장 최근
    // 내전"을 쓰면 안 된다. 왜 안 되는지는 rosterFetchedAt 참고.
    let roundCount = 0;
    const scrimDate = result.scrims[0]?.playedAt
      ? toKstDate(result.scrims[0].playedAt)
      : fetchedAt
        ? toKstDate(fetchedAt)
        : null;
    if (scrimDate) {
      roundCount = await countRounds(supabase, scrimDate);
      // 미연결 참가자 명단은 확정 **전에** 정리하라고 보내는 알림이다. 이번
      // 폴링이 4번째 라운드를 들여온 그 한 번에만 보낸다 — roundCount >= 4 만
      // 보면 버튼을 다시 누를 때마다 같은 명단이 또 온다.
      const reachedFourNow = roundCount >= 4 && roundCount - result.scrimsFound < 4;
      if (reachedFourNow) await notifyUnlinkedPlayers(supabase, scrimDate, rosterId).catch(() => {});
    }

    // 리더보드를 뺀 나머지 기록 화면은 라운드가 하나 들어올 때마다 갱신한다 —
    // 4라운드를 기다릴 이유가 없다. 평균등수도 깐부도 매치가 들어온 만큼 바뀌는
    // 값이고, 리더보드처럼 스냅샷 시점과 맞출 필요가 없다.
    // 잡은 게 없으면 바뀐 것도 없으므로 건드리지 않는다.
    if (result.scrimsFound > 0) revalidateRecordPages();

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
