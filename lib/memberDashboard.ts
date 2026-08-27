// 클랜원 대시보드 — 종합점수 링 게이지 / 평균등수·평균킬 막대 / 최근 N회 내전
// 종합등수 칩에 필요한 값들. 순수 계산 함수는 위쪽, 네트워크는 아래쪽에만 있다.

import { getSupabase } from './supabaseBrowser';
import { TIER_GROUPS, formatChipDate } from './dashboardData';
import {
  RAGE_SCORE_STEEPNESS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  rageScores,
  type RankingStatsRow,
} from './rankingStats';

// 둘째 줄에 늘어놓을 내전 회차 수. 사람마다 다른 게 아니라 **누구에게나 같은
// 10회**를 놓고, 안 나온 회차만 등수 자리를 비운다 — 그래야 옆사람과 칸이
// 맞아떨어져 그대로 비교된다.
export const RECENT_SESSION_COUNT = 10;

export interface RecentSession {
  scrimDate: string; // 'YYYY-MM-DD'
  label: string; // '08-23(일)'
}

export interface SessionStanding {
  memberId: string;
  scrimDate: string;
  standing: number;
}

// 세 지표(종합점수·평균등수·평균킬)가 하나의 읽기 규칙을 공유하게 만드는 척도.
//
// 링 게이지는 좌우 3시·9시가 정확히 절반이라 그 자리가 곧 50점 = 티어 그룹
// 평균이다(rageScores 가 z=0 을 50점으로 두기 때문). 막대도 같아야 해서
// **그룹 평균이 언제나 한가운데(50%)** 에 오도록 값을 편다. 그러면 세 지표 모두
// "가운데를 넘으면 그룹 평균 이상"으로 읽힌다.
//
// spread 는 가운데에서 끝까지가 몇 단위인가다(그룹 표준편차를 쓴다). 양 끝은
// 4~96% 로 묶어서, 아주 잘하거나 못한 사람도 막대가 완전히 비거나 꽉 차 보이지
// 않게 한다 — 0% 는 "기록 없음"으로 오해된다.
export function centeredPercent(
  value: number,
  average: number,
  spread: number,
  higherIsBetter: boolean,
): number {
  if (!Number.isFinite(spread) || spread <= 0) return 50;
  const delta = higherIsBetter ? value - average : average - value;
  return Math.min(96, Math.max(4, 50 + (delta / spread) * 50));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stddev(values: number[], average: number): number {
  if (values.length === 0) return 0;
  return Math.sqrt(mean(values.map((v) => (v - average) ** 2)));
}

// 메달권(1~3위)인지. 4위 이하는 뱃지 칸을 💩 로 채우고, 안 나온 회차는 null 이라
// 여기 오지 않는다.
export function medalRank(standing: number): 1 | 2 | 3 | null {
  return standing === 1 || standing === 2 || standing === 3 ? standing : null;
}

// 사람 → (날짜 → 등수). 칩 한 줄을 그릴 때 세션 목록을 돌면서 조회한다.
export function standingsByMember(rows: SessionStanding[]): Map<string, Map<string, number>> {
  const byMember = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const forMember = byMember.get(row.memberId) ?? new Map<string, number>();
    forMember.set(row.scrimDate, row.standing);
    byMember.set(row.memberId, forMember);
  }
  return byMember;
}

export interface DashboardWindowStats {
  score: number;
  /** 자기 티어 그룹 안에서 종합점수 몇 위인가. */
  scoreRank: number;
  groupSize: number;
  groupLabel: string;
  avgRank: number;
  avgKills: number;
  games: number;
  totalKills: number;
  groupAvgRank: number;
  groupRankSpread: number;
  groupAvgKills: number;
  groupKillsSpread: number;
}

// 대시보드 첫 줄에 필요한 값 한 벌. 창(역대/최근16)마다 한 번씩 부른다.
//
// 비교 대상은 **자기 티어 밴드 안**이다 — 리더보드 종합점수와 같은 경계
// (TIER_SCORE_BANDS)를 쓴다. 클랜 전체로 비교하면 저티어는 늘 바닥에 붙은
// 막대만 보게 되고, 그건 6각형이 티어 그룹 안에서만 비교하는 이유와 같다.
//
// 자격 미달(통산 16경기 미만 또는 3개월 이상 미참가)이면 null 이다 — 그 사람은
// 리더보드에도 없으므로 "그룹 몇 위"라는 말 자체가 성립하지 않는다.
export function buildWindowStats(
  memberId: string,
  rows: RankingStatsRow[],
): DashboardWindowStats | null {
  const scored = rageScores(eligibleForRanking(rows), TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS);
  const me = scored.find((row) => row.memberId === memberId);
  if (!me) return null;

  const bandIndex = TIER_SCORE_BANDS.findIndex((band) => band.includes(me.tier));
  const band = bandIndex === -1 ? null : TIER_SCORE_BANDS[bandIndex];
  const group = band === null ? scored : scored.filter((row) => band.includes(row.tier));

  const sorted = [...group].sort((a, b) => b.score - a.score);
  const ranks = group.map((row) => row.avgRank);
  const kills = group.map((row) => row.avgKills);
  const groupAvgRank = mean(ranks);
  const groupAvgKills = mean(kills);

  // TIER_GROUPS 의 첫 항목은 '전체'(tiers: null)라 밴드 배열과 한 칸 어긋난다.
  const groupLabel =
    bandIndex === -1
      ? '전체'
      : (TIER_GROUPS.filter((g) => g.tiers !== null)[bandIndex]?.label ?? '전체');

  return {
    score: me.score,
    scoreRank: sorted.findIndex((row) => row.memberId === memberId) + 1,
    groupSize: group.length,
    groupLabel,
    avgRank: me.avgRank,
    avgKills: me.avgKills,
    games: me.windowGameCount,
    totalKills: Math.round(me.avgKills * me.windowGameCount),
    groupAvgRank,
    groupRankSpread: stddev(ranks, groupAvgRank),
    groupAvgKills,
    groupKillsSpread: stddev(kills, groupAvgKills),
  };
}

/* ---------- 조회 ---------- */

// 등수가 실제로 기록된 내전만 최신순으로 N회.
//
// scrim_sessions 를 그냥 자르지 않는 이유는 0029 주석에 있다 — 아직 확정하지
// 않은 내전이 빈 칸만 열여섯 개 달고 끼어든다. standing_count 가 1 뿐인 세션도
// 뺀다: 0027 에서 옮겨온 우승팀만 있는 옛 세션이라, 그걸 칸에 놓으면 우승팀
// 넷을 뺀 전원이 "안 나옴"으로 보인다.
export async function fetchRecentSessions(limit = RECENT_SESSION_COUNT): Promise<RecentSession[]> {
  const { data, error } = await getSupabase()
    .from('session_standing_dates')
    .select('scrim_date, standing_count')
    .gt('standing_count', 1)
    .order('scrim_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`내전 회차를 불러오지 못했습니다: ${error.message}`);

  // 화면은 오래된 것 → 최근 순으로 왼쪽부터 놓는다(추세가 왼쪽에서 오른쪽으로 읽히게).
  return (data ?? [])
    .map((row) => ({ scrimDate: row.scrim_date as string, label: formatChipDate(row.scrim_date as string) }))
    .reverse();
}

export async function fetchSessionStandings(scrimDates: string[]): Promise<SessionStanding[]> {
  if (scrimDates.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('member_session_standings')
    .select('member_id, scrim_date, standing')
    .in('scrim_date', scrimDates);
  if (error) throw new Error(`내전 종합등수를 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    memberId: row.member_id as string,
    scrimDate: row.scrim_date as string,
    standing: row.standing as number,
  }));
}

// 한 사람 것만 — 클랜원 상세 페이지는 전원분을 받을 이유가 없다.
export async function fetchMemberStandings(memberId: string): Promise<SessionStanding[]> {
  const { data, error } = await getSupabase()
    .from('member_session_standings')
    .select('member_id, scrim_date, standing')
    .eq('member_id', memberId);
  if (error) throw new Error(`내전 종합등수를 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    memberId: row.member_id as string,
    scrimDate: row.scrim_date as string,
    standing: row.standing as number,
  }));
}
