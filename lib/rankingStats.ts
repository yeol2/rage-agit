// 등수+킬 랭킹 포디움 — 순수 계산 함수. 네트워크는 이 파일 뒷부분(조회 함수)에만 있고,
// 여기 있는 함수들은 Supabase 없이 테스트한다.

import { getSupabase } from './supabaseBrowser';
import { cleanDisplayName, fetchAllMembers } from './memberStats';

// 내전 3회(하루 4경기 기준 12경기) 미만이면 랭킹에서 뺀다.
// 1~2경기짜리 우연을 실력처럼 보여주는 걸 막는다.
export const MIN_GAMES_FOR_RANKING = 12;

// z-score를 softmax로 확률화할 때 쓰는 온도. 값이 클수록 1위와 나머지의 격차가 커진다.
// 실제 데이터로 "1등도 25% 안팎"이 되도록 dev 서버에서 눈으로 보고 조정한 값이다.
export const WIN_PROBABILITY_TEMPERATURE = 1.5;

export interface RankingStatsRow {
  memberId: string;
  discordNickname: string;
  tier: number;
  totalGameCount: number;
  avgKills: number;
  avgPlacementPoints: number;
}

export interface RankingStatsRowWithProbability extends RankingStatsRow {
  probability: number;
}

export function eligibleForRanking(rows: RankingStatsRow[]): RankingStatsRow[] {
  return rows.filter((row) => row.totalGameCount >= MIN_GAMES_FOR_RANKING);
}

export function topByAvgKills(rows: RankingStatsRow[], limit = 3): RankingStatsRow[] {
  return [...rows].sort((a, b) => b.avgKills - a.avgKills).slice(0, limit);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

// 그룹(같은 티어 탭 안) 평균/표준편차로 z-score를 낸 뒤 softmax로 확률화한다.
// 표준편차가 0이면(전원 동점) z-score가 정의되지 않으니 균등 확률로 나눈다.
export function winProbabilities(
  rows: RankingStatsRow[],
  temperature: number,
): RankingStatsRowWithProbability[] {
  if (rows.length === 0) return [];

  const points = rows.map((r) => r.avgPlacementPoints);
  const avg = mean(points);
  const sd = stddev(points, avg);

  if (sd === 0) {
    return rows.map((row) => ({ ...row, probability: 1 / rows.length }));
  }

  const weights = rows.map((row) => Math.exp(((row.avgPlacementPoints - avg) / sd) * temperature));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  return rows.map((row, i) => ({ ...row, probability: weights[i] / totalWeight }));
}

export function topByWinProbability(
  rows: RankingStatsRow[],
  temperature: number,
  limit = 3,
): RankingStatsRowWithProbability[] {
  return winProbabilities(rows, temperature)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

export type RankingWindow = 'recent10' | 'alltime';

interface RankingViewRow {
  member_id: string;
  tier: number;
  avg_kills: number;
  avg_placement_points: number;
}

// member_alltime_stats 는 통산 game_count(자격 판정 기준)를 항상 같이 조회한다 —
// 최근10 창을 볼 때도 자격은 통산 경기 수로 판정한다(0011 설계 참고).
export async function fetchRankingStats(window: RankingWindow): Promise<RankingStatsRow[]> {
  const [alltimeResult, members] = await Promise.all([
    getSupabase()
      .from('member_alltime_stats')
      .select('member_id, tier, game_count, avg_kills, avg_placement_points'),
    fetchAllMembers(),
  ]);
  if (alltimeResult.error) {
    throw new Error(`통산 전적을 불러오지 못했습니다: ${alltimeResult.error.message}`);
  }
  const alltimeData = alltimeResult.data ?? [];

  let windowData: RankingViewRow[] = alltimeData;
  if (window === 'recent10') {
    const { data, error } = await getSupabase()
      .from('member_recent_stats')
      .select('member_id, tier, avg_kills, avg_placement_points');
    if (error) throw new Error(`최근 전적을 불러오지 못했습니다: ${error.message}`);
    windowData = data ?? [];
  }

  const totalGameCountByMember = new Map(alltimeData.map((r) => [r.member_id, r.game_count as number]));
  const nicknameByMember = new Map(members.map((m) => [m.id, cleanDisplayName(m.discordNickname)]));

  return windowData
    .filter((row) => nicknameByMember.has(row.member_id))
    .map((row) => ({
      memberId: row.member_id,
      discordNickname: nicknameByMember.get(row.member_id)!,
      tier: row.tier,
      totalGameCount: totalGameCountByMember.get(row.member_id) ?? 0,
      avgKills: Number(row.avg_kills),
      avgPlacementPoints: Number(row.avg_placement_points),
    }));
}
