// 등수+킬 랭킹 포디움 — 순수 계산 함수. 네트워크는 이 파일 뒷부분(조회 함수)에만 있고,
// 여기 있는 함수들은 Supabase 없이 테스트한다.

import { getSupabase } from './supabaseBrowser';
import { cleanDisplayName, fetchAllMembers, stripTrailingKoreanTag } from './memberStats';
import { TIER_GROUPS } from './dashboardData';
import { ACTIVE_WITHIN_MONTHS, MIN_SCRIMS_FOR_RANKING, matchesFor } from './scrimCounting';

// 자격은 내전 회차로 정하고(lib/scrimCounting.ts), 경기 수는 거기서 파생한다 —
// DB 가 세는 단위가 경기라서 비교할 때만 환산한다.
const MIN_GAMES_FOR_RANKING = matchesFor(MIN_SCRIMS_FOR_RANKING);

export { ACTIVE_WITHIN_MONTHS };

// z-score를 0~100 RAGE Score로 눌러 담는 로지스틱 곡선의 기울기.
// 클수록 평균에서 조금만 벗어나도 점수가 0/100 쪽으로 빨리 붙는다.
export const RAGE_SCORE_STEEPNESS = 1.0;

export interface RankingStatsRow {
  memberId: string;
  discordNickname: string;
  tier: number;
  totalGameCount: number;
  windowGameCount: number;
  avgKills: number;
  avgPlacementPoints: number;
  avgRank: number;
  lastPlayedAt: string;
  // 내전우승 횟수. 랭킹 계산에는 안 쓰고 뱃지 열에만 보인다.
  winCount: number;
}

export interface RankingStatsRowWithScore extends RankingStatsRow {
  score: number;
}

export function eligibleForRanking(rows: RankingStatsRow[], now: Date = new Date()): RankingStatsRow[] {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - ACTIVE_WITHIN_MONTHS);
  return rows.filter(
    (row) => row.totalGameCount >= MIN_GAMES_FOR_RANKING && new Date(row.lastPlayedAt) >= cutoff,
  );
}

export function topByAvgKills(rows: RankingStatsRow[], limit = 3): RankingStatsRow[] {
  return [...rows].sort((a, b) => b.avgKills - a.avgKills).slice(0, limit);
}

// 등수는 숫자가 낮을수록(1등에 가까울수록) 좋다 — 오름차순 정렬.
export function topByAvgRank(rows: RankingStatsRow[], limit = 3): RankingStatsRow[] {
  return [...rows].sort((a, b) => a.avgRank - b.avgRank).slice(0, limit);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

// 시트 검산 기준 "합계"(점수+킬)는 그대로 두고, 종합점수(z-score) 계산에서만
// 킬에 티어별 가중치를 곱한다. 고티어(0~1.5)일수록 오더를 직접 짜는 쪽이라
// 등수가 실력을 더 잘 반영하고, 저티어로 갈수록 등수가 오더 따라가기에 좌우돼
// 개인 실력 반영도가 떨어지므로 킬 비중을 더 준다.
// TIER_SCORE_BANDS와 같은 순서(0~1.5 / 2~2.5 / 3~3.5 / 4~5)로 대응한다.
export const TIER_KILL_WEIGHTS: number[] = [1, 1.75, 2.5, 3.25];

// 매치당 종합점수 = 배치점수 + 킬*가중치.
function totalScore(
  row: Pick<RankingStatsRow, 'avgPlacementPoints' | 'avgKills'>,
  killWeight: number,
): number {
  return row.avgPlacementPoints + row.avgKills * killWeight;
}

// row.tier 가 속하는 밴드(0~1.5, 2~2.5 같은 고정 티어 그룹)의 인덱스를 찾는다.
// "전체" 탭에서도 이 고정 밴드 기준으로 이미 계산된 점수를 그대로 모아 보여준다 —
// 전체 인원을 하나로 다시 묶어 계산하면 인원수 많은 쪽 점수가 눌리는 문제가 생긴다.
function tierBandIndexOf(tier: number, tierBands: number[][]): number {
  return tierBands.findIndex((band) => band.includes(tier));
}

// 점수는 "자기 고정 티어 밴드" 안에서 계산한다 — 대시보드 티어 탭과 같은 경계다.
// TierRankingPodium·01 네임플레이트 배지·등수 스냅샷 캡처가 전부 이 상수를 공유한다.
export const TIER_SCORE_BANDS: number[][] = TIER_GROUPS.filter((group) => group.tiers !== null).map(
  (group) => group.tiers!,
);

// 각자 자기 고정 티어 밴드 안에서 z-score를 낸 뒤, 로지스틱으로 0~100 점수화한다.
// z=0(밴드 평균)이면 항상 50점 — 밴드 인원수와 무관하다.
// 표준편차가 0(밴드 전원 동점, 또는 1명)이면 z=0으로 두어 50점을 준다.
export function rageScores(
  rows: RankingStatsRow[],
  tierBands: number[][],
  steepness: number,
): RankingStatsRowWithScore[] {
  const byBand = new Map<number, RankingStatsRow[]>();
  for (const row of rows) {
    const idx = tierBandIndexOf(row.tier, tierBands);
    if (idx === -1) continue;
    if (!byBand.has(idx)) byBand.set(idx, []);
    byBand.get(idx)!.push(row);
  }

  const result: RankingStatsRowWithScore[] = [];
  for (const [idx, bandRows] of byBand.entries()) {
    const killWeight = TIER_KILL_WEIGHTS[idx] ?? 1;
    const points = bandRows.map((row) => totalScore(row, killWeight));
    const avg = mean(points);
    const sd = stddev(points, avg);

    for (let i = 0; i < bandRows.length; i++) {
      const z = sd === 0 ? 0 : (points[i] - avg) / sd;
      const score = 100 / (1 + Math.exp(-steepness * z));
      result.push({ ...bandRows[i], score });
    }
  }
  return result;
}

export function topByRageScore(
  rows: RankingStatsRow[],
  tierBands: number[][],
  steepness: number,
  limit = 3,
): RankingStatsRowWithScore[] {
  return rageScores(rows, tierBands, steepness)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type RankingWindow = 'recent16' | 'alltime';

interface RankingViewRow {
  member_id: string;
  tier: number;
  game_count: number;
  avg_kills: number;
  avg_placement_points: number;
  avg_rank: number;
}

// member_alltime_stats 는 통산 game_count(자격 판정 기준)를 항상 같이 조회한다 —
// 최근12 창을 볼 때도 자격은 통산 경기 수로 판정한다(0011 설계 참고).
export async function fetchRankingStats(window: RankingWindow): Promise<RankingStatsRow[]> {
  const [alltimeResult, members, winsResult] = await Promise.all([
    getSupabase()
      .from('member_alltime_stats')
      .select('member_id, tier, game_count, avg_kills, avg_placement_points, avg_rank, last_played_at'),
    fetchAllMembers(),
    getSupabase().from('member_win_counts').select('member_id, win_count'),
  ]);
  if (alltimeResult.error) {
    throw new Error(`통산 전적을 불러오지 못했습니다: ${alltimeResult.error.message}`);
  }
  if (winsResult.error) {
    throw new Error(`우승 횟수를 불러오지 못했습니다: ${winsResult.error.message}`);
  }
  const alltimeData = alltimeResult.data ?? [];
  // 우승이 한 번도 없으면 뷰에 행 자체가 없다 — 없는 사람은 0 이다.
  const winCountByMember = new Map(
    (winsResult.data ?? []).map((r) => [r.member_id as string, r.win_count as number]),
  );

  let windowData: RankingViewRow[] = alltimeData;
  if (window === 'recent16') {
    // 6각형이 쓰는 member_recent_stats 가 아니라 랭킹 전용 뷰다 —
    // 이쪽만 스크린샷 백필까지 합쳐서 최근 16경기(내전 4회)를 센다 (0013/0021).
    const { data, error } = await getSupabase()
      .from('member_recent_ranking_stats')
      .select('member_id, tier, game_count, avg_kills, avg_placement_points, avg_rank');
    if (error) throw new Error(`최근 전적을 불러오지 못했습니다: ${error.message}`);
    windowData = data ?? [];
  }

  const totalGameCountByMember = new Map(alltimeData.map((r) => [r.member_id, r.game_count as number]));
  const lastPlayedByMember = new Map(
    alltimeData.map((r) => [r.member_id, r.last_played_at as string]),
  );
  const nicknameByMember = new Map(
    members.map((m) => [m.id, stripTrailingKoreanTag(cleanDisplayName(m.discordNickname))]),
  );

  return windowData
    .filter((row) => nicknameByMember.has(row.member_id))
    .map((row) => ({
      memberId: row.member_id,
      discordNickname: nicknameByMember.get(row.member_id)!,
      tier: row.tier,
      totalGameCount: totalGameCountByMember.get(row.member_id) ?? 0,
      windowGameCount: row.game_count,
      avgKills: Number(row.avg_kills),
      avgPlacementPoints: Number(row.avg_placement_points),
      avgRank: Number(row.avg_rank),
      lastPlayedAt: lastPlayedByMember.get(row.member_id) ?? new Date(0).toISOString(),
      winCount: winCountByMember.get(row.member_id) ?? 0,
    }));
}
