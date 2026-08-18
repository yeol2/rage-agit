// 클랜원 6각형 지표 — 순수 계산 함수. 네트워크는 이 파일 뒷부분(조회 함수)에만 있고,
// 여기 있는 함수들은 Supabase 없이 테스트한다.

import { getSupabase } from './supabaseBrowser';

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

// 명단 화면은 MEMBER_STAT_TIER_GROUPS(백분위 비교용 4개 묶음)와 달리
// 0~5티어를 전부 따로 보여준다 — 사람을 찾는 화면이라 세분화가 낫고,
// 표본 크기를 걱정할 이유가 없다(집계가 아니라 목록일 뿐이다).
export const ALL_TIERS = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// discord_nickname 원본은 그대로 두고 화면에서만 다듬는다 — 괄호 태그,
// 이모지, 슬래시 뒤 부계정 표기를 뗀다("Ez_A/Ez_B" 처럼 본계정+부계정을
// 합쳐놓은 표기가 화면에서 너무 길어져서 본계정만 남긴다).
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

export function cleanDisplayName(discordNickname: string): string {
  return discordNickname
    .replace(/\([^)]*\)/g, '')
    .replace(EMOJI_PATTERN, '')
    .split('/')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

// cleanDisplayName 은 괄호 뒤에 남은 한글 장식(예: "Ez_D (98)은킹" → "Ez_D 은킹")을
// 의도적으로 남긴다 — 구분용으로 쓰던 자리라 그대로 둔 것들이 있다. 반면 클랜원
// 목록/개인 페이지, 팀 구성 테이블처럼 "Ez_XXXX" 순수 형태만 보여줘야 하는 화면은
// cleanDisplayName 뒤에 이 함수를 한 번 더 거친다. 결과가 통째로 비면(닉네임이
// 한글뿐인 경우) 자르지 않는다.
export function stripTrailingKoreanTag(name: string): string {
  const stripped = name.replace(/\s*[가-힣]+$/, '').trim();
  return stripped.length > 0 ? stripped : name;
}

export interface TierColorRamp {
  from: string;
  to: string;
}

// 참고 이미지의 배색. 0티어와 5티어는 단독, 나머지는 정수·반티어를 묶어
// 같은 색을 쓴다 — MEMBER_STAT_TIER_GROUPS 와 묶는 경계가 비슷하지만
// 여긴 색상표라 5티어를 4~4.5 에 합치지 않고 따로 둔다(그림에 그렇게 있다).
const TIER_COLOR_RAMPS: Array<{ tiers: number[]; ramp: TierColorRamp }> = [
  { tiers: [0], ramp: { from: '#9e6bff', to: '#9fc1ff' } },
  { tiers: [1, 1.5], ramp: { from: '#4cadd0', to: '#b2f9ff' } },
  { tiers: [2, 2.5], ramp: { from: '#db8a42', to: '#ffde90' } },
  { tiers: [3, 3.5], ramp: { from: '#369876', to: '#71ff9e' } },
  { tiers: [4, 4.5], ramp: { from: '#ff5dd6', to: '#ff9cbf' } },
  { tiers: [5], ramp: { from: '#f5dc1f', to: '#f0e9ca' } },
];

export function tierColorRamp(tier: number): TierColorRamp {
  const found = TIER_COLOR_RAMPS.find((entry) => entry.tiers.includes(tier));
  if (!found) throw new Error(`배색표에 없는 티어: ${tier}`);
  return found.ramp;
}

export interface NameplateStyle {
  background: string;
  borderColor: string;
  boxShadow: string;
}

// tierColorRamp 는 정수·반티어를 묶어 같은 색을 쓴다(2~2.5, 3~3.5) — 클랜원
// 목록/팀 구성 테이블의 작은 카드에서는 그래서 2티어와 2.5티어가 눈으로 안 갈렸다.
// 배경색은 그대로 두고, 반티어(.5)만 테두리를 없애 같은 색 묶음 안에서도
// 구분되게 한다(정수 티어는 테두리 있음, 반티어는 테두리 없음).
export function tierNameplateStyle(tier: number): NameplateStyle {
  const ramp = tierColorRamp(tier);
  const isHalfTier = tier % 1 !== 0;

  return {
    // 배경 채우기도 어두운 화면 바탕에 묻히지 않게 40(25%) 불투명도로 준다.
    background: `linear-gradient(135deg, ${ramp.from}40, ${ramp.to}40)`,
    // 정수 티어 테두리는 눈에 확 띄도록 거의 불투명(e6)하게 준다 — 반티어(테두리 없음)와의
    // 대비가 흐릿하면 구분한 보람이 없다.
    borderColor: isHalfTier ? 'transparent' : `${ramp.from}e6`,
    boxShadow: `0 0 10px ${ramp.from}40`,
  };
}

// 팀 구성 테이블 2단계(팀짜기)에서 네임플레이트를 클릭해 "선택함" 상태를 표시할 때
// 쓸 진한 배색 — 지금은 아무 데서도 안 부르지만, 색 규칙만 먼저 정해둔다.
// 기본 상태(background 40, e6)보다 한 단계 더 진해야 하므로 배경/테두리 모두 위로 올린다.
export function tierNameplateSelectedStyle(tier: number): NameplateStyle {
  const ramp = tierColorRamp(tier);

  return {
    background: `linear-gradient(135deg, ${ramp.from}73, ${ramp.to}73)`,
    borderColor: `${ramp.from}ff`,
    boxShadow: `0 0 10px ${ramp.from}66`,
  };
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

// 대시보드 경기 표(ScrimSessionRow)가 이미 쓰는 용어와 맞춘다 —
// '화력'·'결정력' 같은 추상적인 말보다 딜량·킬 그대로가 더 직관적이다.
export const HEXAGON_AXIS_LABELS: Record<HexagonAxisKey, string> = {
  damage: '딜량',
  kills: '킬',
  headshot: '헤드샷',
  survival: '생존',
  assists: '어시',
  rank: '순위',
};

export interface HexagonAxis {
  key: HexagonAxisKey;
  label: string;
  percentile: number;
  // 코호트 평균이 같은 코호트 안에서 몇 번째 백분위인지. 본인 도형(실선)
  // 옆에 점선으로 겹쳐 그려서 "나는 평균보다 위인가 아래인가"를 보여준다.
  averagePercentile: number;
}

function average(values: number[]): number {
  const pool = values.filter((v) => Number.isFinite(v));
  if (pool.length === 0) return 0;
  return pool.reduce((sum, v) => sum + v, 0) / pool.length;
}

function axisPercentiles(
  targetValue: number,
  cohortValues: number[],
  higherIsBetter: boolean,
): { percentile: number; averagePercentile: number } {
  return {
    percentile: percentile(targetValue, cohortValues, higherIsBetter),
    averagePercentile: percentile(average(cohortValues), cohortValues, higherIsBetter),
  };
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
      ...axisPercentiles(target.avgDamage, cohort.map((c) => c.avgDamage), true),
    },
    {
      key: 'kills',
      label: HEXAGON_AXIS_LABELS.kills,
      ...axisPercentiles(target.avgKills, cohort.map((c) => c.avgKills), true),
    },
    {
      key: 'headshot',
      label: HEXAGON_AXIS_LABELS.headshot,
      percentile: target.headshotRatio === null ? 0 : percentile(target.headshotRatio, headshotPool, true),
      averagePercentile: percentile(average(headshotPool), headshotPool, true),
    },
    {
      key: 'survival',
      label: HEXAGON_AXIS_LABELS.survival,
      ...axisPercentiles(target.avgSurvival, cohort.map((c) => c.avgSurvival), true),
    },
    {
      key: 'assists',
      label: HEXAGON_AXIS_LABELS.assists,
      ...axisPercentiles(target.avgAssists, cohort.map((c) => c.avgAssists), true),
    },
    {
      key: 'rank',
      label: HEXAGON_AXIS_LABELS.rank,
      ...axisPercentiles(target.avgRank, cohort.map((c) => c.avgRank), false),
    },
  ];
}

export interface MemberSummary {
  id: string;
  discordNickname: string;
  tier: number;
}

export async function fetchAllMembers(): Promise<MemberSummary[]> {
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier')
    .eq('is_active', true)
    .order('discord_nickname');
  if (error) throw new Error(`클랜원 명단을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    discordNickname: row.discord_nickname,
    tier: row.tier,
  }));
}

export async function fetchMember(memberId: string): Promise<MemberSummary | null> {
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier')
    .eq('id', memberId)
    .maybeSingle();
  if (error) throw new Error(`클랜원 정보를 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;

  return { id: data.id, discordNickname: data.discord_nickname, tier: data.tier };
}

function toStatsRow(row: {
  member_id: string;
  tier: number;
  game_count: number;
  avg_damage: number;
  avg_kills: number;
  headshot_ratio: number | null;
  avg_survival: number;
  avg_assists: number;
  avg_rank: number;
}): MemberRecentStatsRow {
  return {
    memberId: row.member_id,
    tier: row.tier,
    gameCount: row.game_count,
    avgDamage: Number(row.avg_damage),
    avgKills: Number(row.avg_kills),
    headshotRatio: row.headshot_ratio === null ? null : Number(row.headshot_ratio),
    avgSurvival: Number(row.avg_survival),
    avgAssists: Number(row.avg_assists),
    avgRank: Number(row.avg_rank),
  };
}

export async function fetchMemberRecentStats(memberId: string): Promise<MemberRecentStatsRow | null> {
  const { data, error } = await getSupabase()
    .from('member_recent_stats')
    .select('member_id, tier, game_count, avg_damage, avg_kills, headshot_ratio, avg_survival, avg_assists, avg_rank')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw new Error(`최근 전적을 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;

  return toStatsRow(data);
}

// 같은 티어 그룹 전체의 표본을 한 번에 가져온다 — 백분위 비교 대상이다.
// MIN_GAMES_FOR_HEXAGON 미만인 사람은 비교 대상에서 뺀다(본인이 그 미만이면
// 애초에 6각형을 안 그리므로 이 함수까지 안 온다).
export async function fetchTierCohortStats(tiers: number[]): Promise<MemberRecentStatsRow[]> {
  const { data, error } = await getSupabase()
    .from('member_recent_stats')
    .select('member_id, tier, game_count, avg_damage, avg_kills, headshot_ratio, avg_survival, avg_assists, avg_rank')
    .in('tier', tiers)
    .gte('game_count', MIN_GAMES_FOR_HEXAGON);
  if (error) throw new Error(`티어 그룹 전적을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map(toStatsRow);
}
