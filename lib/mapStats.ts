// 맵별 기록 — "나는 어느 맵에서 잘하고 어느 맵에서 못하나".
//
// 재료는 member_map_stats 뷰가 만든다. 여기서는 순서만 정한다.
//
// 뷰는 두 시대를 합친다(0042). 매치 기록에는 맵 이름이 실제로 있고, 그 이전
// 스크린샷 기록에는 라운드 번호밖에 없지만 맵 순서가 고정이라 되살릴 수 있다.
// 그래서 맵별 기록의 총경기 수는 전적 요약과 정확히 같다 — 아래 SCRIM_MAP_ORDER
// 가 화면 순서인 동시에 그 복원 규칙이기도 하다.
//
// 자격선을 걸지 않는다. 뛴 맵은 전부 보여주고 경기 수를 같이 적는다 — 그 사실을
// 숨기는 것보다 경기 수를 옆에 적어 읽는 사람이 감안하게 하는 편이 정직하다.

import { getSupabase } from './supabaseBrowser';
import { mapLabel } from './mapNames';

// 내전 네 라운드의 맵 순서. 화면도 이 순서로 늘어놓는다 — 사람들이 그날 겪은
// 순서라 1라운드부터 읽는 것이 자연스럽다.
export const SCRIM_MAP_ORDER = ['Neon_Main', 'Baltic_Main', 'Desert_Main', 'Tiger_Main'];

export interface MapStat {
  memberId: string;
  mapName: string;
  /** 화면에 쓰는 한글 이름. */
  label: string;
  games: number;
  avgRank: number;
  avgKills: number;
  /** 그 사람의 **전체** 경기 수. 맵 평균이 얼마나 두꺼운 표본인지의 기준. */
  totalGames: number;
  /** 그 사람의 전체 평균등수. 네 줄이 공유하는 기준선이다. */
  overallAvgRank: number;
  overallAvgKills: number;
}

/** 전체 평균보다 이 맵에서 몇 등 좋았나. 양수면 이 맵이 강한 쪽이다. */
export function rankDelta(stat: MapStat): number {
  return stat.overallAvgRank - stat.avgRank;
}

export function killsDelta(stat: MapStat): number {
  return stat.avgKills - stat.overallAvgKills;
}

export function sortByScrimOrder<T extends { mapName: string }>(rows: T[]): T[] {
  const rank = (mapName: string) => {
    const index = SCRIM_MAP_ORDER.indexOf(mapName);
    // 순서표에 없는 맵(내전 구성이 바뀌었거나 옛 기록)은 뒤에 붙인다.
    return index === -1 ? SCRIM_MAP_ORDER.length : index;
  };
  return [...rows].sort(
    (a, b) => rank(a.mapName) - rank(b.mapName) || a.mapName.localeCompare(b.mapName),
  );
}

/* ---------- 조회 ---------- */

export async function fetchMemberMapStats(memberId: string): Promise<MapStat[]> {
  const { data, error } = await getSupabase()
    .from('member_map_stats')
    .select(
      'member_id, map_name, games, avg_rank, avg_kills, total_games, overall_avg_rank, overall_avg_kills',
    )
    .eq('member_id', memberId);
  if (error) throw new Error(`맵별 기록을 불러오지 못했습니다: ${error.message}`);

  return sortByScrimOrder(
    (data ?? []).map((row) => ({
      memberId: row.member_id as string,
      mapName: row.map_name as string,
      label: mapLabel(row.map_name as string),
      games: row.games as number,
      avgRank: Number(row.avg_rank),
      avgKills: Number(row.avg_kills),
      totalGames: row.total_games as number,
      overallAvgRank: Number(row.overall_avg_rank),
      overallAvgKills: Number(row.overall_avg_kills),
    })),
  );
}
