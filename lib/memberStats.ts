// 클랜원 6각형 지표 — 순수 계산 함수. 네트워크는 이 파일 뒷부분(조회 함수)에만 있고,
// 여기 있는 함수들은 Supabase 없이 테스트한다.

export interface MemberRecentStatsRow {
  memberId: string;
  tier: number;
  gameCount: number;
  avgDamage: number;
  avgKills: number;
  headshotRatio: number | null;
  avgSurvival: number;
  avgAssists: number;
  avgRank: number;
}

// 4경기(내전 하루치) 미만이면 6각형을 그리지 않는다.
// 1~2경기짜리 우연을 실력처럼 보여주는 걸 막는다.
export const MIN_GAMES_FOR_HEXAGON = 4;

export interface TierCohortGroup {
  id: string;
  label: string;
  tiers: number[];
}

// 이 클랜은 0티어가 최상위, 숫자가 커질수록 초심자다. 클랜 전체 기준으로
// 백분위를 매기면 저티어는 항상 쭈그러든 육각형만 보게 된다 — 그래서
// 같은 티어 그룹 안에서만 비교한다.
//
// 5티어는 인원이 2명뿐이라 그 자체로는 백분위가 의미 없어서 4~4.5 그룹에
// 합친다. lib/dashboardData.ts 의 TIER_GROUPS(티어 랭킹 포디움용)와 숫자
// 경계는 같지만 5티어를 넣는 지점만 다르고, 화면의 관심사도 서로 달라
// 상수를 공유하지 않는다.
export const MEMBER_STAT_TIER_GROUPS: TierCohortGroup[] = [
  { id: '0-1.5', label: '0~1.5티어', tiers: [0, 1, 1.5] },
  { id: '2-2.5', label: '2~2.5티어', tiers: [2, 2.5] },
  { id: '3-3.5', label: '3~3.5티어', tiers: [3, 3.5] },
  { id: '4-5', label: '4~5티어', tiers: [4, 4.5, 5] },
];

export function tierGroupFor(tier: number): TierCohortGroup | null {
  return MEMBER_STAT_TIER_GROUPS.find((group) => group.tiers.includes(tier)) ?? null;
}

// value 가 cohortValues 안에서 몇 번째 백분위인지. 자기 자신도 비교 대상에 포함된다
// (표본이 자기 혼자면 100이 나오는데, 이건 의도된 동작이다).
//
// higherIsBetter=false 인 축(등수)은 방향을 뒤집는다 — "나보다 등수가 나쁜(숫자가 큰)
// 사람이 몇 명인가"를 센다.
export function percentile(value: number, cohortValues: number[], higherIsBetter: boolean): number {
  const pool = cohortValues.filter((v) => Number.isFinite(v));
  if (pool.length === 0) return 0;
  const count = higherIsBetter
    ? pool.filter((v) => v <= value).length
    : pool.filter((v) => v >= value).length;
  return Math.round((count / pool.length) * 100);
}

export type HexagonAxisKey = 'damage' | 'kills' | 'headshot' | 'survival' | 'assists' | 'rank';

export const HEXAGON_AXIS_LABELS: Record<HexagonAxisKey, string> = {
  damage: '화력',
  kills: '결정력',
  headshot: '정확도',
  survival: '생존력',
  assists: '팀 기여',
  rank: '성적',
};

export interface HexagonAxis {
  key: HexagonAxisKey;
  label: string;
  percentile: number;
}

export function buildHexagonAxes(
  target: MemberRecentStatsRow,
  cohort: MemberRecentStatsRow[],
): HexagonAxis[] {
  // 헤드샷 비율이 없는 사람(킬이 0인 채로 4경기 이상 뛴 경우)은 정확도
  // 비교 대상에서 뺀다 — null 을 숫자로 잘못 취급하면 백분위가 틀어진다.
  const headshotPool = cohort
    .map((c) => c.headshotRatio)
    .filter((v): v is number => v !== null);

  return [
    {
      key: 'damage',
      label: HEXAGON_AXIS_LABELS.damage,
      percentile: percentile(target.avgDamage, cohort.map((c) => c.avgDamage), true),
    },
    {
      key: 'kills',
      label: HEXAGON_AXIS_LABELS.kills,
      percentile: percentile(target.avgKills, cohort.map((c) => c.avgKills), true),
    },
    {
      key: 'headshot',
      label: HEXAGON_AXIS_LABELS.headshot,
      percentile: target.headshotRatio === null ? 0 : percentile(target.headshotRatio, headshotPool, true),
    },
    {
      key: 'survival',
      label: HEXAGON_AXIS_LABELS.survival,
      percentile: percentile(target.avgSurvival, cohort.map((c) => c.avgSurvival), true),
    },
    {
      key: 'assists',
      label: HEXAGON_AXIS_LABELS.assists,
      percentile: percentile(target.avgAssists, cohort.map((c) => c.avgAssists), true),
    },
    {
      key: 'rank',
      label: HEXAGON_AXIS_LABELS.rank,
      percentile: percentile(target.avgRank, cohort.map((c) => c.avgRank), false),
    },
  ];
}
