// 클랜원 6각형 지표 — 순수 계산 함수. 네트워크는 이 파일 뒷부분(조회 함수)에만 있고,
// 여기 있는 함수들은 Supabase 없이 테스트한다.

import { getSupabase } from './supabaseBrowser';
// 흩어진 정도를 재는 함수는 클랜원 대시보드와 같은 것을 쓴다.
import { mean, stddev } from './memberDashboard';
import { MIN_SCRIMS_FOR_RANKING, matchesFor } from './scrimCounting';

export interface MemberHexagonStatsRow {
  memberId: string;
  tier: number;
  gameCount: number;
  avgDamage: number;
  avgKills: number;
  /** 최근 창 안에서 팀등수가 얼마나 흔들렸나(표본표준편차). 작을수록 안정적. */
  rankStddev: number | null;
  avgSurvival: number;
  avgAssists: number;
  avgRank: number;
}

// 6각형을 그리기 위한 최소 표본 — 리더보드 자격과 같은 선이다(통산 내전 4회).
// 리더보드에는 있는데 6각형은 없는(또는 그 반대인) 사람이 생기면, 왜 그런지
// 설명할 말이 화면 어디에도 없다.
//
// 다만 리더보드의 "최근 3개월" 규칙은 따라가지 않는다. 등수를 다투는 자리에서는
// 접은 사람을 빼야 하지만, 자기 페이지의 6각형은 접었다고 지울 기록이 아니다.
export const MIN_SCRIMS_FOR_HEXAGON = MIN_SCRIMS_FOR_RANKING;
export const MIN_GAMES_FOR_HEXAGON = matchesFor(MIN_SCRIMS_FOR_HEXAGON);

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
    .replace(/^본\s*[:：]\s*/, '') // "본:Ez_A /부: Ez_B" → "Ez_A /부: Ez_B"
    .replace(/\([^)]*\)/g, '')
    .replace(EMOJI_PATTERN, '')
    .split('/')[0]
    .replace(/\s*부계.*$/, '') // "Ez_A 부계 Ez_B" → "Ez_A"
    .replace(/\s+\d{2}$/, '') // "Ez_A 94" → "Ez_A" (괄호 없이 붙은 출생년도 표기)
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
  color: string;
}

// 흰색에 티어 색을 섞는다 — 글자는 근본적으로 흰색이되, 티어 색이 눈에 띄게 비치는
// 정도. amount 는 섞는 비율(0~1)이다. 0.15(너무 옅음) → 0.4(너무 진함) → 0.275(중간)로 조정했다.
function mixWithWhite(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel * amount + 255 * (1 - amount));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// 02(팀 구성 테이블)에서 고정된 카드에 쓴다 — 티어 색과 무관하게 채도를 다
// 죽인 회색조 하나로 통일한다(참고 이미지의 비활성 브라우저 탭처럼). tier
// 배색을 옅게/진하게 조절하는 게 아니라 아예 색 자체를 꺼서 "잠긴" 느낌을 준다.
// text-menu(#A0A0A2, 이 프로젝트에서 이미 쓰는 흐린 회색 라벨 색)를 그대로 쓴다.
export function fixedNameplateStyle(): NameplateStyle {
  return {
    background: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    boxShadow: 'none',
    color: '#A0A0A2',
  };
}

// 0~5티어 전부 같은 방식 — tierColorRamp 의 그라데이션(from→to)을 깐다.
// 어두운 배경(#0E0B13) 위라 너무 옅으면(26/66/40) 색이 죽어 보인다는 피드백을 받아
// 전체적으로 한 단계씩 밝혔다. 시작 지점(from)은 그마저도 너무 어두워 보인다는
// 피드백을 받아 흰색을 살짝 섞어 밝힌 색을 쓴다(예: 5티어 시작이 탁한 카키색
// 대신 또렷한 노란색으로 보이도록).
export function tierNameplateStyle(tier: number): NameplateStyle {
  const ramp = tierColorRamp(tier);
  const start = mixWithWhite(ramp.from, 0.65);

  return {
    background: `linear-gradient(135deg, ${start}40, ${ramp.to}40)`,
    borderColor: `${ramp.from}99`,
    boxShadow: `0 0 10px ${ramp.from}60`,
    color: mixWithWhite(ramp.from, 0.1),
  };
}

// 팀 구성 테이블 2단계(팀짜기)에서 네임플레이트를 클릭해 "선택함" 상태를 표시할 때
// 쓸 배색 — 지금은 아무 데서도 안 부르지만, 색 규칙만 먼저 정해둔다.
// 기본 상태(40/99/60)보다 한 단계 더 진해야 한다.
export function tierNameplateSelectedStyle(tier: number): NameplateStyle {
  const ramp = tierColorRamp(tier);
  const start = mixWithWhite(ramp.from, 0.65);

  return {
    background: `linear-gradient(135deg, ${start}73, ${ramp.to}73)`,
    borderColor: `${ramp.from}cc`,
    boxShadow: `0 0 10px ${ramp.from}80`,
    color: mixWithWhite(ramp.from, 0.1),
  };
}

export type HexagonAxisKey = 'damage' | 'kills' | 'stability' | 'survival' | 'assists' | 'rank';

// 대시보드 경기 표(ScrimSessionRow)가 이미 쓰는 용어와 맞춘다 —
// '화력'·'결정력' 같은 추상적인 말보다 딜량·킬 그대로가 더 직관적이다.
export const HEXAGON_AXIS_LABELS: Record<HexagonAxisKey, string> = {
  damage: '딜량',
  kills: '킬',
  stability: '안정성',
  survival: '생존',
  assists: '어시',
  rank: '순위',
};

// 6각형 축 하나. 도형 위 위치와 툴팁에 적을 실제 값을 같이 들고 있다.
export interface HexagonAxis {
  key: HexagonAxisKey;
  label: string;
  /** 내 값의 위치(%). 4~96 사이. */
  percent: number;
  /** 내 티어 그룹 평균의 위치(%). 축마다 다르다 — 아래 눈금 설명 참고. */
  averagePercent: number;
  /** 내 값을 사람이 읽는 형태로. 툴팁이 그대로 적는다. */
  valueText: string;
  /** 티어 그룹 평균값. 〃 */
  averageText: string;
}

// 티어 그룹마다 점선이 놓이는 자리. **축과 무관하게 고정**이라 점선은 언제나
// 정확한 정육각형이고, 높은 티어 그룹일수록 크다.
//
// 값에서 계산하지 않고 박아두는 이유가 있다. 여섯 축 중 딜량·킬·어시만 티어를
// 가르고, 순위·생존·안정성은 그룹끼리 거의 같다(순위 평균 8.51 / 8.66 / 8.65 /
// 9.04). 팀을 티어로 맞춰 짜니 어느 그룹이든 팀 등수가 비슷하게 나오기 때문이다.
// 그 값들을 그대로 반지름으로 옮기면 점선이 세 축만 튀어나온 찌그러진 모양이
// 된다. 그래서 점선은 "내가 어느 무리에 있는가"를 나타내는 표식으로 삼고,
// 실제 값은 실선과 툴팁 숫자가 말한다.
//
// 이 선택의 대가는 분명하다 — 같은 반지름이 티어 그룹마다 다른 값을 뜻한다.
// 4~5티어의 점선 위에 붙은 실선과 0~1.5티어의 점선 위에 붙은 실선은 "우리 그룹
// 평균만큼"이라는 같은 말이지 같은 딜량이 아니다.
const TIER_RING_PERCENT: Record<string, number> = {
  '0-1.5': 80,
  '2-2.5': 65,
  '3-3.5': 50,
  '4-5': 35,
};

// 티어 그룹을 못 찾았을 때(배색표에 없는 티어) 쓰는 자리. 가운데 고리다.
const DEFAULT_RING_PERCENT = 50;

// 자기 그룹 평균에서 1 표준편차 떨어질 때마다 도형이 움직이는 폭. 티어 그룹
// 사이 간격(15)과 같게 맞췄다 — "1 표준편차 위 = 한 그룹 위만큼"으로 읽힌다.
// 표준편차는 클랜 전체에서 잰다. 그룹 안에서 재면 인원이 적은 그룹(0~1.5 는
// 21명)에서 한두 명 때문에 눈금이 출렁인다.
export const HEXAGON_SIGMA_STEP = 15;

export function tierRingPercent(tier: number): number {
  const group = tierGroupFor(tier);
  return group ? (TIER_RING_PERCENT[group.id] ?? DEFAULT_RING_PERCENT) : DEFAULT_RING_PERCENT;
}

// 툴팁에 적을 형식. 축마다 단위와 자릿수가 다르다.
const AXIS_FORMAT: Record<HexagonAxisKey, (value: number) => string> = {
  damage: (v) => `${Math.round(v)}딜`,
  kills: (v) => `${v.toFixed(2)}킬`,
  // 안정성은 등수의 표준편차라 단위가 '등'이다 — 낮을수록 덜 흔들린다.
  stability: (v) => `±${v.toFixed(2)}등`,
  survival: (v) => `${(v / 60).toFixed(1)}분`,
  assists: (v) => `${v.toFixed(2)}어시`,
  rank: (v) => `${v.toFixed(1)}등`,
};

/**
 * 6각형 여섯 축.
 *
 * clan 은 흩어진 정도(표준편차)를 재는 표본이고, group 은 내 티어 그룹이다.
 * 점선은 그룹의 고정 반지름에, 실선은 그 반지름에서 "우리 그룹 평균과 얼마나
 * 떨어졌나"만큼 안팎으로 옮겨 찍는다.
 */
export function buildHexagonAxes(
  target: MemberHexagonStatsRow,
  clan: MemberHexagonStatsRow[],
  group: MemberHexagonStatsRow[],
): HexagonAxis[] {
  const ringPercent = tierRingPercent(target.tier);

  const build = (
    key: HexagonAxisKey,
    pick: (row: MemberHexagonStatsRow) => number | null,
    higherIsBetter: boolean,
  ): HexagonAxis => {
    // null 은 어디서도 숫자로 취급하지 않는다 — 안정성은 경기가 하나뿐이면 없다.
    const clanValues = clan.map(pick).filter((v): v is number => v !== null);
    const groupValues = group.map(pick).filter((v): v is number => v !== null);

    const clanAverage = mean(clanValues);
    const spread = stddev(clanValues, clanAverage);
    const groupAverage = mean(groupValues);
    const value = pick(target);

    const percent =
      value === null || spread <= 0
        ? ringPercent
        : clamp(
            ringPercent +
              ((higherIsBetter ? value - groupAverage : groupAverage - value) / spread) *
                HEXAGON_SIGMA_STEP,
          );

    return {
      key,
      label: HEXAGON_AXIS_LABELS[key],
      percent,
      averagePercent: ringPercent,
      valueText: value === null ? '기록 없음' : AXIS_FORMAT[key](value),
      averageText: AXIS_FORMAT[key](groupAverage),
    };
  };

  return [
    build('damage', (r) => r.avgDamage, true),
    build('kills', (r) => r.avgKills, true),
    // 안정성은 등수 편차라 **작을수록 좋다** — 순위 축과 같은 방향이다.
    build('stability', (r) => r.rankStddev, false),
    build('survival', (r) => r.avgSurvival, true),
    build('assists', (r) => r.avgAssists, true),
    build('rank', (r) => r.avgRank, false),
  ];
}

// 도형이 중심에 뭉치거나 격자 밖으로 나가지 않게 묶는다. 0% 는 "기록 없음"으로
// 오해되고 100% 는 라벨을 덮는다.
function clamp(percent: number): number {
  return Math.min(96, Math.max(4, percent));
}

export interface MemberSummary {
  id: string;
  discordNickname: string;
  tier: number;
  // VIP 등수(1등이 최상위) — 내전 펀딩을 많이 했거나 VIP 명단에 있는 사람에게만 있다.
  // VIP 라고 해서 tier 섹션에서 빠지지 않는다 — 클랜원 목록에는 VIP 섹션과 원래 티어
  // 섹션 양쪽에 다 나오는 게 의도된 동작이다.
  vipRank: number | null;
}

export async function fetchAllMembers(): Promise<MemberSummary[]> {
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier, vip_rank')
    .eq('is_active', true)
    .order('discord_nickname');
  if (error) throw new Error(`클랜원 명단을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    discordNickname: row.discord_nickname,
    tier: row.tier,
    vipRank: row.vip_rank,
  }));
}

export async function fetchMember(memberId: string): Promise<MemberSummary | null> {
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier, vip_rank')
    .eq('id', memberId)
    .maybeSingle();
  if (error) throw new Error(`클랜원 정보를 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;

  return { id: data.id, discordNickname: data.discord_nickname, tier: data.tier, vipRank: data.vip_rank };
}

// 내전우승 횟수. 우승 기록이 한 번도 없으면 뷰에 행 자체가 없으므로 0 이다.
export async function fetchMemberWinCount(memberId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('member_win_counts')
    .select('win_count')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw new Error(`우승 횟수를 불러오지 못했습니다: ${error.message}`);
  return data?.win_count ?? 0;
}

function toStatsRow(row: {
  member_id: string;
  tier: number;
  game_count: number;
  avg_damage: number;
  avg_kills: number;
  rank_stddev: number | null;
  avg_survival: number;
  avg_assists: number;
  avg_rank: number;
}): MemberHexagonStatsRow {
  return {
    memberId: row.member_id,
    tier: row.tier,
    gameCount: row.game_count,
    avgDamage: Number(row.avg_damage),
    avgKills: Number(row.avg_kills),
    rankStddev: row.rank_stddev === null ? null : Number(row.rank_stddev),
    avgSurvival: Number(row.avg_survival),
    avgAssists: Number(row.avg_assists),
    avgRank: Number(row.avg_rank),
  };
}

export async function fetchMemberHexagonStats(memberId: string): Promise<MemberHexagonStatsRow | null> {
  const { data, error } = await getSupabase()
    .from('member_hexagon_stats')
    .select('member_id, tier, game_count, avg_damage, avg_kills, avg_survival, avg_assists, avg_rank, rank_stddev')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw new Error(`최근 전적을 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;

  return toStatsRow(data);
}

// 6각형이 볼 표본 — 집계 대상 전원이다(역대 전체). 눈금은 클랜 전체 기준 하나이고
// (buildHexagonAxes 주석 참고), 티어 그룹은 이 목록에서 갈라 쓴다.
// MIN_GAMES_FOR_HEXAGON 미만인 사람은 뺀다(본인이 그 미만이면 애초에 6각형을
// 안 그리므로 이 함수까지 안 온다).
export async function fetchHexagonCohort(): Promise<MemberHexagonStatsRow[]> {
  const { data, error } = await getSupabase()
    .from('member_hexagon_stats')
    .select('member_id, tier, game_count, avg_damage, avg_kills, avg_survival, avg_assists, avg_rank, rank_stddev')
    .gte('game_count', MIN_GAMES_FOR_HEXAGON);
  if (error) throw new Error(`6각형 비교 표본을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map(toStatsRow);
}
