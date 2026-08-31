// 나의 깐부 / 다시는 보지 말자 — "누구와 같은 팀일 때 성적이 좋았나".
//
// 재료는 member_partner_stats 뷰(0034·0035)가 다 만들어 준다. 여기서는 자격선을
// 걸고 양 끝을 고른다. 순수 함수가 위, 네트워크는 아래에만 있다.

import { getSupabase } from './supabaseBrowser';

// 같은 팀으로 최소 몇 **번의 내전**을 함께해야 후보인가. 경기 수로 세지 않는
// 이유는 0035 주석에 있다 — 그날 라운드가 3판이냐 5판이냐에 따라 같은 두 번이
// 통과하기도 떨어지기도 한다.
//
// 1회로 낮추면 조합의 82%가 후보가 되는데, 그 대부분은 그날 팀이 잘 굴러갔는지를
// 말할 뿐 두 사람의 궁합이 아니다. 2회면 후보가 817쌍으로 줄지만 클랜원 126명은
// 여전히 최소 한 명의 후보를 갖는다.
export const MIN_SESSIONS_TOGETHER = 2;

// 비교 기준(그 사람과 같은 팀이 아니었던 내전)도 최소 이만큼은 있어야 한다.
// 없으면 "함께일 때 몇 등 좋아졌나"의 기준선 자체가 존재하지 않는다.
export const MIN_SESSIONS_APART = 1;

export interface PartnerStat {
  partnerId: string;
  sessionsTogether: number;
  gamesTogether: number;
  avgRankTogether: number;
  avgRankApart: number;
  /** 양수면 함께일 때 등수가 그만큼 좋아졌다는 뜻(등수는 작을수록 좋다). */
  rankDelta: number;
}

export interface PartnerChemistry {
  /** 함께일 때 성적이 가장 좋아진 사람들. 동률이면 전원, 없으면 빈 배열. */
  best: PartnerStat[];
  /** 함께일 때 성적이 가장 나빠진 사람들. */
  worst: PartnerStat[];
}

// 화면이 그대로 그릴 수 있게 이름·티어까지 붙인 모양.
export interface PartnerCard extends PartnerStat {
  displayName: string;
  tier: number;
}

// 화면에 적히는 자릿수. 동률 판정도 이 값으로 한다 — 화면에 같은 숫자가
// 찍혔는데 한 명만 뽑혀 있으면 그건 읽는 사람에게 그냥 틀린 표다.
export function displayedDelta(rankDelta: number): number {
  return Math.round(rankDelta * 10) / 10;
}

// 표본이 얇을수록 차이를 0 쪽으로 당기는 정도. 클수록 세게 당긴다.
//
// 이게 없으면 카드는 늘 **가장 적게 함께한 사람**을 뽑는다. 자격을 통과한 817개
// 조합 중 664개가 딱 2회짜리이고, 두 번만 같이 하면 그날 운이 그대로 평균이 돼서
// ±3~6등이 예사로 나온다. 반대로 9회를 함께한 조합(Ez_JuHyuN ↔ Ez_Hyuk9)은
// 차이가 1.25등뿐이다 — 경기가 쌓이면 진짜 값으로 수렴하기 때문이다. 그대로
// 두면 "가장 잘 맞는 사람"이 아니라 "표본이 가장 얇아 튄 사람"이 뽑힌다.
//
// 2를 쓰면 2회는 차이의 절반만, 3회는 60%, 4회는 3분의 2, 9회는 82%가 남는다.
// 얇은 표본이 두꺼운 표본을 이기려면 그만큼 더 큰 차이를 보여야 한다.
const SHRINK_SESSIONS = 2;

// 뽑을 때 쓰는 값. 화면에 적히는 숫자는 이게 아니라 실제 차이(rankDelta)다 —
// 카드는 두 평균을 나란히 보여주므로, 그 둘의 차이와 다른 수를 적으면 읽는
// 사람이 뺄셈을 해보고 틀렸다고 생각한다. 보정은 순서를 정하는 데만 쓴다.
export function shrunkDelta(row: PartnerStat): number {
  return (row.rankDelta * row.sessionsTogether) / (row.sessionsTogether + SHRINK_SESSIONS);
}

// 양 끝을 고른다. **동률이면 전원**이다(예: 둘 다 ▲3.0등이면 둘 다 보여준다).
//
// 부호를 지킨다: 좋아지지 않은 사람은 깐부 자리에 오지 않고, 나빠지지 않은
// 사람은 반대 자리에 오지 않는다. 반올림해서 0.0등이 되는 사람도 뺀다 —
// "▲0.0등 좋아짐"은 아무 말도 하지 않는다.
export function pickPartners(rows: PartnerStat[]): PartnerChemistry {
  return {
    best: extremes(rows, 1),
    worst: extremes(rows, -1),
  };
}

function extremes(rows: PartnerStat[], direction: 1 | -1): PartnerStat[] {
  const candidates = rows.filter((row) => displayedDelta(row.rankDelta) * direction > 0);
  if (candidates.length === 0) return [];

  // 순서는 보정값으로 정하고,
  const winner = candidates.reduce((best, row) =>
    shrunkDelta(row) * direction > shrunkDelta(best) * direction ||
    (shrunkDelta(row) === shrunkDelta(best) && row.sessionsTogether > best.sessionsTogether)
      ? row
      : best,
  );

  // 한 칸에 세우는 기준은 **화면에 찍히는 숫자**다. 차이는 칸 위에 한 번만
  // 적으므로, 같은 숫자로 보이는 사람이 빠져 있으면 그 표는 틀린 표가 된다.
  const shown = displayedDelta(winner.rankDelta);

  return candidates
    .filter((row) => displayedDelta(row.rankDelta) === shown)
    // 같은 값이면 더 오래 함께한 사람을 위에 둔다 — 표본이 두꺼운 쪽이 덜 우연이다.
    .sort((a, b) => b.sessionsTogether - a.sessionsTogether || b.gamesTogether - a.gamesTogether);
}

/* ---------- 조회 ---------- */

export async function fetchPartnerStats(memberId: string): Promise<PartnerStat[]> {
  const { data, error } = await getSupabase()
    .from('member_partner_stats')
    .select(
      'partner_id, sessions_together, games_together, avg_rank_together, avg_rank_apart, rank_delta',
    )
    .eq('member_id', memberId)
    .gte('sessions_together', MIN_SESSIONS_TOGETHER)
    .gte('sessions_apart', MIN_SESSIONS_APART);
  if (error) throw new Error(`같은 팀 기록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? [])
    // rank_delta 가 null 인 행(함께한 경기가 전부인 사람)은 sessions_apart 필터에서
    // 이미 걸리지만, 뷰의 null 규칙이 바뀌어도 화면에 NaN 이 뜨지 않게 한 번 더 막는다.
    .filter((row) => row.rank_delta !== null)
    .map((row) => ({
      partnerId: row.partner_id as string,
      sessionsTogether: row.sessions_together as number,
      gamesTogether: row.games_together as number,
      avgRankTogether: Number(row.avg_rank_together),
      avgRankApart: Number(row.avg_rank_apart),
      rankDelta: Number(row.rank_delta),
    }));
}

// 뽑힌 사람들의 이름만 채운다 — 후보 전원의 이름을 받을 이유가 없다.
export async function fetchPartnerNames(
  partnerIds: string[],
): Promise<Map<string, { discordNickname: string; tier: number }>> {
  if (partnerIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier')
    .in('id', partnerIds);
  if (error) throw new Error(`같은 팀 기록의 이름을 불러오지 못했습니다: ${error.message}`);

  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      { discordNickname: row.discord_nickname as string, tier: row.tier as number },
    ]),
  );
}
