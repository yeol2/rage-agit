// 맵별 기록 — "이 사람은 어느 맵에서 잘하고 어느 맵에서 못하나".
//
// 재료는 member_map_stats 뷰(0040)가 만든다. 여기서는 순서를 정하고, 맵마다
// 한 명씩 신/똥을 고른다. 순수 함수가 위, 네트워크는 아래에만 있다.

import { getSupabase } from './supabaseBrowser';
import { mapLabel } from './mapNames';
import { MIN_SCRIMS_FOR_RANKING, shrink } from './scrimCounting';

// 내전 네 라운드의 맵 순서. 화면도 이 순서로 늘어놓는다 — 사람들이 그날 겪은
// 순서라 1라운드부터 읽는 것이 자연스럽다.
export const SCRIM_MAP_ORDER = ['Neon_Main', 'Baltic_Main', 'Desert_Main', 'Tiger_Main'];

// 맵 기록에 오를 자격 — 그 맵을 몇 경기 뛰었나.
//
// 참가한 내전 회차가 곧 맵당 경기 수라서(0040 주석), 이 값은 리더보드 자격과
// 같은 선이다. 맵마다 따로 정할 이유가 없다.
export const MIN_GAMES_PER_MAP = MIN_SCRIMS_FOR_RANKING;

export interface MapStat {
  memberId: string;
  mapName: string;
  /** 화면에 쓰는 한글 이름. */
  label: string;
  games: number;
  avgRank: number;
  avgKills: number;
  /** 그 사람의 **다른 맵** 평균등수. 비교 기준이다. */
  otherAvgRank: number | null;
  /** 양수면 이 맵에서 다른 맵보다 그만큼 좋은 등수를 했다는 뜻. */
  rankDelta: number | null;
}

export type MapBadgeKind = 'god' | 'poop';

export interface MapBadge {
  memberId: string;
  mapName: string;
  label: string;
  kind: MapBadgeKind;
  games: number;
  avgRank: number;
  otherAvgRank: number;
  rankDelta: number;
}

// 화면에 적히는 자릿수. 신/똥을 고를 때의 동률 판정도 이 값으로 한다.
export function displayedDelta(rankDelta: number): number {
  return Math.round(rankDelta * 10) / 10;
}

export function sortByScrimOrder<T extends { mapName: string }>(rows: T[]): T[] {
  const rank = (mapName: string) => {
    const index = SCRIM_MAP_ORDER.indexOf(mapName);
    // 순서표에 없는 맵(내전 구성이 바뀌었거나 옛 기록)은 뒤에 붙인다.
    return index === -1 ? SCRIM_MAP_ORDER.length : index;
  };
  return [...rows].sort((a, b) => rank(a.mapName) - rank(b.mapName) || a.mapName.localeCompare(b.mapName));
}

/**
 * 맵마다 신 한 명, 똥 한 명.
 *
 * 순서는 보정값으로 정한다 — 4경기짜리 큰 차이가 12경기짜리 꾸준한 차이를
 * 그냥 이기면, 뽑히는 사람이 "그 맵을 잘하는 사람"이 아니라 "그 맵을 적게 뛴
 * 사람"이 된다(lib/scrimCounting.ts 의 shrink 참고). 화면에 적는 숫자는 보정
 * 전 실제 차이다.
 *
 * 부호를 지킨다: 다른 맵보다 나을 게 없는 사람은 신이 되지 않고, 그 반대도
 * 마찬가지다. 반올림해서 0.0등이 되는 사람도 뺀다 — "다른 맵보다 0.0등 좋음"은
 * 아무 말도 하지 않는다.
 */
export function pickMapBadges(rows: MapStat[]): MapBadge[] {
  const byMap = new Map<string, MapStat[]>();
  for (const row of rows) {
    if (row.games < MIN_GAMES_PER_MAP || row.rankDelta === null || row.otherAvgRank === null) continue;
    byMap.set(row.mapName, [...(byMap.get(row.mapName) ?? []), row]);
  }

  const badges: MapBadge[] = [];
  for (const [mapName, mapRows] of byMap) {
    for (const [kind, direction] of [
      ['god', 1],
      ['poop', -1],
    ] as Array<[MapBadgeKind, 1 | -1]>) {
      const candidates = mapRows.filter((row) => displayedDelta(row.rankDelta!) * direction > 0);
      if (candidates.length === 0) continue;

      const winner = candidates.reduce((best, row) =>
        shrink(row.rankDelta!, row.games) * direction > shrink(best.rankDelta!, best.games) * direction
          ? row
          : best,
      );
      badges.push({
        memberId: winner.memberId,
        mapName,
        label: winner.label,
        kind,
        games: winner.games,
        avgRank: winner.avgRank,
        otherAvgRank: winner.otherAvgRank!,
        rankDelta: winner.rankDelta!,
      });
    }
  }

  return sortByScrimOrder(badges);
}

/* ---------- 조회 ---------- */

function toMapStat(row: {
  member_id: string;
  map_name: string;
  games: number;
  avg_rank: number;
  avg_kills: number;
  other_avg_rank: number | null;
  rank_delta: number | null;
}): MapStat {
  return {
    memberId: row.member_id,
    mapName: row.map_name,
    label: mapLabel(row.map_name),
    games: row.games,
    avgRank: Number(row.avg_rank),
    avgKills: Number(row.avg_kills),
    otherAvgRank: row.other_avg_rank === null ? null : Number(row.other_avg_rank),
    rankDelta: row.rank_delta === null ? null : Number(row.rank_delta),
  };
}

const MAP_COLUMNS = 'member_id, map_name, games, avg_rank, avg_kills, other_avg_rank, rank_delta';

export async function fetchMemberMapStats(memberId: string): Promise<MapStat[]> {
  const { data, error } = await getSupabase()
    .from('member_map_stats')
    .select(MAP_COLUMNS)
    .eq('member_id', memberId);
  if (error) throw new Error(`맵별 기록을 불러오지 못했습니다: ${error.message}`);
  return sortByScrimOrder((data ?? []).map(toMapStat));
}

// 신/똥을 고르려면 클랜 전체가 필요하다. 자격 미달은 애초에 후보가 아니므로
// 여기서 걸러 받는다 — 680행 중 420행이다.
export async function fetchMapBadges(): Promise<MapBadge[]> {
  const { data, error } = await getSupabase()
    .from('member_map_stats')
    .select(MAP_COLUMNS)
    .gte('games', MIN_GAMES_PER_MAP);
  if (error) throw new Error(`맵 뱃지를 불러오지 못했습니다: ${error.message}`);
  return pickMapBadges((data ?? []).map(toMapStat));
}
