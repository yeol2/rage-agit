import { getSupabase } from './supabaseBrowser';
import { TIER_GROUPS, type TierGroup } from './dashboardData';
import { MIN_SCRIMS_FOR_RANKING, matchesFor } from './scrimCounting';

/**
 * 플레이 스타일 뱃지 — 티어 그룹마다 한 명씩 다는 별명 뱃지다.
 *
 * 잘하고 못하고를 재는 게 아니라 **어떻게 싸우는 사람인가**를 하나 집어서
 * 놀리는 자리다. 그래서 순위표와 달리 값이 높다고 좋은 것도, 낮다고 나쁜 것도
 * 아니다 — 양 끝에 선 사람에게 하나씩 붙는다.
 *
 * 세 뱃지가 보는 값은 둘뿐이다:
 *
 * - 킬당 딜량(총딜 ÷ 총킬): 높으면 '최강 딜딸러'(딜은 넣는데 킬로 못 바꾼다),
 *   낮으면 '최강 킬딸러'(적은 딜로 킬만 챙긴다). 한 값의 양 끝이라 두 뱃지가
 *   한 사람에게 같이 갈 수는 없다.
 * - 기절당 킬(총킬 ÷ 총기절): 낮으면 '실속 없는 사람'. 눕히기만 하고 마무리를
 *   못 한다는 뜻이다.
 *
 * 더 정교한 지표(킬 수로 기대되는 딜량 대비 초과분 같은 잔차)도 같은 데이터로
 * 재봤는데, 네 그룹 중 세 그룹에서 같은 사람을 뽑았다. 설명할 수 없는 값을
 * 쓸 이유가 없어서 단순한 비율로 간다 — 뱃지 설명표에 "킬당 280딜"이라고 적으면
 * 본 사람이 검산도 할 수 있다.
 *
 * 원래 하고 싶었던 건 '확킬'(내가 눕힌 사람을 내가 마무리했는지)인데, 그 값은
 * PUBG 텔레메트리에만 있고 우리가 저장하는 경기 스탯에는 없다. 기절당 킬은
 * 그것의 대용이다 — 내 킬이 남이 눕힌 것을 주워 먹은 것일 수도 있어 정확히
 * 같은 값은 아니지만, "눕히기만 하고 못 끝내는 사람"은 이 값이 확실히 낮다.
 *
 * 표본은 PUBG API 로 받은 경기뿐이다. 스크린샷으로 받아적은 내전에는 딜량·기절이
 * 없어서(migration 0043 주석) 전적 요약의 경기 수보다 적게 잡힌다.
 */
export type PlaystyleBadgeKind = 'damageFarmer' | 'killFarmer' | 'hollow';

export interface PlaystyleStatsRow {
  memberId: string;
  tier: number;
  gameCount: number;
  totalKills: number;
  totalDbnos: number;
  totalDamage: number;
}

/** 뱃지 후보가 되는 최소 경기 수 — 리더보드·6각형과 같은 선(내전 4회)이다. */
export const MIN_GAMES_FOR_PLAYSTYLE_BADGE = matchesFor(MIN_SCRIMS_FOR_RANKING);

/**
 * 경기 수와 별개로 **분모**에도 하한을 둔다.
 *
 * 경기 수만 보면 16경기를 다 뛰고 통산 4킬인 사람이 킬당 딜량 1등으로 올라온다
 * (실측: 4킬 2409딜 = 킬당 602). 킬이 한 자리면 그 값은 스타일이 아니라 한두
 * 판의 운이다. 20 은 후보들의 통산 킬·기절 분포에서 하위 25% 선이다
 * (중앙값은 킬 33, 기절 35).
 */
export const MIN_KILLS_FOR_PLAYSTYLE_BADGE = 20;
export const MIN_DBNOS_FOR_PLAYSTYLE_BADGE = 20;

/** 뱃지를 다투는 무대 — '전체'는 빼고 실제 티어 그룹만. */
export const BADGE_TIER_GROUPS: TierGroup[] = TIER_GROUPS.filter((group) => group.tiers !== null);

export interface PlaystyleBadgeHolder {
  kind: PlaystyleBadgeKind;
  memberId: string;
  /** 어느 무대에서 1등인가 — 설명표에 "3~3.5티어 1위"로 적는다. */
  groupId: string;
  groupLabel: string;
  /** 뱃지를 준 근거값. 설명표에 사람 말로 풀어 적는다. */
  value: number;
}

function damagePerKill(row: PlaystyleStatsRow): number | null {
  return row.totalKills >= MIN_KILLS_FOR_PLAYSTYLE_BADGE
    ? row.totalDamage / row.totalKills
    : null;
}

function killsPerDbno(row: PlaystyleStatsRow): number | null {
  return row.totalDbnos >= MIN_DBNOS_FOR_PLAYSTYLE_BADGE
    ? row.totalKills / row.totalDbnos
    : null;
}

// 동점이면 표본이 많은 쪽이 가져간다 — 같은 값이어도 오래 그래온 사람이
// 별명의 주인이다. 그것마저 같으면 memberId 순으로 잘라, 새로고침할 때마다
// 뱃지 주인이 바뀌지 않게 한다.
function morePersuasive(a: PlaystyleStatsRow, b: PlaystyleStatsRow): boolean {
  if (a.gameCount !== b.gameCount) return a.gameCount > b.gameCount;
  return a.memberId < b.memberId;
}

function pickEnd(
  rows: PlaystyleStatsRow[],
  valueOf: (row: PlaystyleStatsRow) => number | null,
  want: 'max' | 'min',
): { row: PlaystyleStatsRow; value: number } | null {
  let best: { row: PlaystyleStatsRow; value: number } | null = null;

  for (const row of rows) {
    const value = valueOf(row);
    if (value === null) continue;

    if (best === null) {
      best = { row, value };
      continue;
    }

    const wins =
      value === best.value
        ? morePersuasive(row, best.row)
        : want === 'max'
          ? value > best.value
          : value < best.value;
    if (wins) best = { row, value };
  }

  return best;
}

/**
 * 티어 그룹마다 뱃지 주인을 고른다. 경기 수가 모자란 사람은 후보에서 빠지고,
 * 후보가 아무도 없는 뱃지는 결과에 넣지 않는다(빈 뱃지를 "아직 없음"으로
 * 그리지 않는다).
 */
export function pickPlaystyleBadges(rows: PlaystyleStatsRow[]): PlaystyleBadgeHolder[] {
  const eligible = rows.filter((row) => row.gameCount >= MIN_GAMES_FOR_PLAYSTYLE_BADGE);
  const holders: PlaystyleBadgeHolder[] = [];

  for (const group of BADGE_TIER_GROUPS) {
    const inGroup = eligible.filter((row) => group.tiers!.includes(row.tier));

    const picks: Array<[PlaystyleBadgeKind, ReturnType<typeof pickEnd>]> = [
      ['damageFarmer', pickEnd(inGroup, damagePerKill, 'max')],
      ['killFarmer', pickEnd(inGroup, damagePerKill, 'min')],
      ['hollow', pickEnd(inGroup, killsPerDbno, 'min')],
    ];

    for (const [kind, pick] of picks) {
      if (!pick) continue;
      holders.push({
        kind,
        memberId: pick.row.memberId,
        groupId: group.id,
        groupLabel: group.label,
        value: pick.value,
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
