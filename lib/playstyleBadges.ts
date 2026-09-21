import { getSupabase } from './supabaseBrowser';
import { TIER_GROUPS, type TierGroup } from './dashboardData';
import { MIN_SCRIMS_FOR_RANKING, matchesFor } from './scrimCounting';

/**
 * 플레이 스타일 뱃지 — 티어 그룹마다 금·은·동 한 명씩 다는 별명 뱃지다.
 *
 * 잘하고 못하고를 재는 게 아니라 **어떻게 싸우는 사람인가**를 하나 집어서
 * 놀리는 자리다. 뱃지 하나에 12명(4그룹 × 금은동)이 달린다.
 *
 * ## 재는 법: 그 구간의 평균을 기준선으로 두고, 거기서 얼마나 벗어났나
 *
 * 티어 그룹 안의 합계로 기준선 둘을 만든다 — **킬 하나 = 딜 얼마**,
 * **기절 하나 = 킬 얼마**. 그리고 그 기준선대로라면 이 사람이 냈어야 할 값과
 * 실제 값의 차이를 경기당으로 잰다.
 *
 * - 최강 딜딸러 = 경기당 초과 딜. 킬 수로 기대되는 딜보다 얼마나 더 퍼부었나.
 * - 최강 킬딸러 = 경기당 초과 킬. 딜 양으로 기대되는 킬보다 얼마나 더 챙겼나.
 * - 실속 없는 사람 = 경기당 놓친 킬. 기절 수로 기대되는 킬보다 얼마나 모자라나.
 *
 * 기준선을 그룹마다 따로 잡는 이유는, 구간에 따라 "보통"이 다르기 때문이다 —
 * 실측으로 킬 하나에 드는 딜이 0~1.5티어 171, 2~2.5티어 188, 3~3.5티어 177,
 * 4~5티어 182 로 갈린다. 클랜 전체 하나의 선으로 재면 그 차이가 그 사람의
 * 성향인 것처럼 섞여 들어간다.
 *
 * 앞의 둘은 한 값의 양 끝이라(초과딜 = −(킬당 딜) × 초과킬) 한 사람이 같은
 * 그룹에서 둘 다 달 수는 없다.
 *
 * ## 왜 비율(킬당 딜량)이 아닌가
 *
 * 비율은 분모가 작을수록 유리하다. 실측으로, 킬당 딜량으로 뽑으면 1위가
 * 경기당 딜 121(클랜 81위/92)인 사람이었다 — 딜을 퍼부어서가 아니라 킬이
 * 없어서 비율이 커진 것이라 "최강 딜딸러"라는 이름과 반대로 돈다. 경기당
 * 절대량으로 재면 딜을 적게 넣는 사람은 애초에 큰 값이 안 나온다.
 *
 * 표본은 PUBG API 로 받은 경기뿐이다. 스크린샷으로 받아적은 내전에는 딜량·기절이
 * 없어서(migration 0043 주석) 전적 요약의 경기 수보다 적게 잡힌다.
 */
export type PlaystyleBadgeKind = 'damageFarmer' | 'killFarmer' | 'hollow';

/** 금·은·동. 티어 그룹마다 뱃지별로 세 명뿐이다. */
export type BadgeMedal = 1 | 2 | 3;

export interface PlaystyleStatsRow {
  memberId: string;
  tier: number;
  gameCount: number;
  totalKills: number;
  totalDbnos: number;
  totalDamage: number;
}

/** 뱃지 후보가 되는 최소 경기 수 — 리더보드·6각형과 같은 선(내전 4회 = 16경기). */
export const MIN_GAMES_FOR_PLAYSTYLE_BADGE = matchesFor(MIN_SCRIMS_FOR_RANKING);

/**
 * 경기 수와 별개로 킬·기절에도 하한을 둔다. 기준선 대비 차이는 절대량이라
 * 비율만큼 튀지는 않지만, 통산 킬이 한 자리인 사람의 값은 여전히 그날 운이다.
 * 20 은 후보들의 통산 킬·기절 분포에서 하위 25% 선이다(중앙값은 킬 33, 기절 35).
 */
export const MIN_KILLS_FOR_PLAYSTYLE_BADGE = 20;
export const MIN_DBNOS_FOR_PLAYSTYLE_BADGE = 20;

/** 뱃지를 다투는 무대 — '전체'는 빼고 실제 티어 그룹만. */
export const BADGE_TIER_GROUPS: TierGroup[] = TIER_GROUPS.filter((group) => group.tiers !== null);

export interface PlaystyleBadgeHolder {
  kind: PlaystyleBadgeKind;
  memberId: string;
  medal: BadgeMedal;
  /** 어느 무대에서 받았나 — 설명표에 "3~3.5티어 금메달"로 적는다. */
  groupId: string;
  groupLabel: string;
  /** 기준선에서 벗어난 정도(경기당). 딜딸러는 딜, 나머지는 킬 단위다. */
  value: number;
}

/** 한 구간의 합계로 만든 기준선. */
export interface Baseline {
  /** 킬 하나에 딜 얼마 */
  damagePerKill: number;
  /** 기절 하나에 킬 얼마 */
  killsPerDbno: number;
}

export function baselineOf(rows: PlaystyleStatsRow[]): Baseline {
  const kills = rows.reduce((sum, r) => sum + r.totalKills, 0);
  const dbnos = rows.reduce((sum, r) => sum + r.totalDbnos, 0);
  const damage = rows.reduce((sum, r) => sum + r.totalDamage, 0);
  return {
    damagePerKill: kills > 0 ? damage / kills : 0,
    killsPerDbno: dbnos > 0 ? kills / dbnos : 0,
  };
}

export function eligibleForPlaystyleBadge(row: PlaystyleStatsRow): boolean {
  return (
    row.gameCount >= MIN_GAMES_FOR_PLAYSTYLE_BADGE &&
    row.totalKills >= MIN_KILLS_FOR_PLAYSTYLE_BADGE &&
    row.totalDbnos >= MIN_DBNOS_FOR_PLAYSTYLE_BADGE
  );
}

// 기준선대로라면 냈어야 할 값과의 차이 — 전부 경기당으로 맞춘다.
function extraDamagePerGame(row: PlaystyleStatsRow, base: Baseline): number {
  return (row.totalDamage - row.totalKills * base.damagePerKill) / row.gameCount;
}

function extraKillsPerGame(row: PlaystyleStatsRow, base: Baseline): number {
  if (base.damagePerKill <= 0) return 0;
  return (row.totalKills - row.totalDamage / base.damagePerKill) / row.gameCount;
}

function missedKillsPerGame(row: PlaystyleStatsRow, base: Baseline): number {
  return (row.totalDbnos * base.killsPerDbno - row.totalKills) / row.gameCount;
}

export const PLAYSTYLE_METRICS: Record<
  PlaystyleBadgeKind,
  (row: PlaystyleStatsRow, base: Baseline) => number
> = {
  damageFarmer: extraDamagePerGame,
  killFarmer: extraKillsPerGame,
  hollow: missedKillsPerGame,
};

interface GroupMedians {
  damagePerGame: number;
  killsPerGame: number;
  dbnosPerGame: number;
}

/**
 * 반대쪽 조건 — 이게 없으면 **그 구간 최고 선수가 놀림 뱃지의 금메달**을 받는다.
 *
 * 실측: 가드 없이 경기당 초과 킬만 보면 킬딸러 금메달이 클랜 킬 1위·딜 2위인
 * 사람이었다. 딜도 킬도 최상위인데 킬이 조금 더 최상위라서 차이가 벌어진 것이라,
 * "적은 딜로 킬만 챙긴다"는 놀림과 정반대다.
 *
 * 그래서 각 뱃지는 이름이 전제하는 쪽을 실제로 하고 있어야 후보가 된다 —
 * 딜딸러는 킬이 시원찮아야(그룹 중앙값 이하), 킬딸러는 딜이 적어야(이하),
 * 실속 없는 사람은 눕히기는 많이 해야(이상) 한다.
 */
const PLAYSTYLE_GUARDS: Record<
  PlaystyleBadgeKind,
  (row: PlaystyleStatsRow, mid: GroupMedians) => boolean
> = {
  damageFarmer: (row, mid) => row.totalKills / row.gameCount <= mid.killsPerGame,
  killFarmer: (row, mid) => row.totalDamage / row.gameCount <= mid.damagePerGame,
  hollow: (row, mid) => row.totalDbnos / row.gameCount >= mid.dbnosPerGame,
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// 값이 같으면 표본이 많은 쪽이 위다 — 같은 값이어도 오래 그래온 사람이 별명의
// 주인이다. 그것마저 같으면 memberId 순으로 잘라, 새로고침할 때마다 메달이
// 바뀌지 않게 한다.
function compare(
  a: { value: number; row: PlaystyleStatsRow },
  b: { value: number; row: PlaystyleStatsRow },
): number {
  if (a.value !== b.value) return b.value - a.value;
  if (a.row.gameCount !== b.row.gameCount) return b.row.gameCount - a.row.gameCount;
  return a.row.memberId < b.row.memberId ? -1 : 1;
}

/**
 * 티어 그룹마다 뱃지별 금·은·동을 고른다. 자격 미달은 후보에서 빠지고, 후보가
 * 셋보다 적으면 있는 만큼만 준다(빈 메달을 "아직 없음"으로 그리지 않는다).
 */
export function pickPlaystyleBadges(rows: PlaystyleStatsRow[]): PlaystyleBadgeHolder[] {
  const eligible = rows.filter(eligibleForPlaystyleBadge);
  const holders: PlaystyleBadgeHolder[] = [];

  for (const group of BADGE_TIER_GROUPS) {
    const inGroup = eligible.filter((row) => group.tiers!.includes(row.tier));
    if (inGroup.length === 0) continue;

    const base = baselineOf(inGroup);
    const mid: GroupMedians = {
      damagePerGame: median(inGroup.map((r) => r.totalDamage / r.gameCount)),
      killsPerGame: median(inGroup.map((r) => r.totalKills / r.gameCount)),
      dbnosPerGame: median(inGroup.map((r) => r.totalDbnos / r.gameCount)),
    };

    for (const kind of Object.keys(PLAYSTYLE_METRICS) as PlaystyleBadgeKind[]) {
      inGroup
        .filter((row) => PLAYSTYLE_GUARDS[kind](row, mid))
        .map((row) => ({ row, value: PLAYSTYLE_METRICS[kind](row, base) }))
        // 기준선을 실제로 벗어난 사람만 받는다. 후보가 적은 그룹에서는 이게
        // 없으면 "기대보다 오히려 0.05킬 적은" 사람이 동메달을 받는다(실측).
        .filter(({ value }) => value > 0)
        .sort(compare)
        .slice(0, 3)
        .forEach(({ row, value }, index) => {
          holders.push({
            kind,
            memberId: row.memberId,
            medal: (index + 1) as BadgeMedal,
            groupId: group.id,
            groupLabel: group.label,
            value,
          });
        });
    }
  }

  return holders;
}

/** memberId → 그 사람이 단 뱃지들. 화면은 자기 것만 꺼내 쓴다. */
export function badgesByMember(
  holders: PlaystyleBadgeHolder[],
): Map<string, PlaystyleBadgeHolder[]> {
  const byMember = new Map<string, PlaystyleBadgeHolder[]>();
  for (const holder of holders) {
    byMember.set(holder.memberId, [...(byMember.get(holder.memberId) ?? []), holder]);
  }
  return byMember;
}

export async function fetchPlaystyleStats(): Promise<PlaystyleStatsRow[]> {
  const { data, error } = await getSupabase()
    .from('member_playstyle_stats')
    .select('member_id, tier, game_count, total_kills, total_dbnos, total_damage')
    .gte('game_count', MIN_GAMES_FOR_PLAYSTYLE_BADGE);
  if (error) throw new Error(`뱃지 집계를 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    memberId: row.member_id as string,
    tier: Number(row.tier),
    gameCount: Number(row.game_count),
    totalKills: Number(row.total_kills),
    totalDbnos: Number(row.total_dbnos),
    totalDamage: Number(row.total_damage),
  }));
}

/** 뱃지 주인들을 한 번에 — 화면 두 곳(리더보드·클랜원 상세)이 같이 쓴다. */
export async function fetchPlaystyleBadges(): Promise<Map<string, PlaystyleBadgeHolder[]>> {
  return badgesByMember(pickPlaystyleBadges(await fetchPlaystyleStats()));
}
