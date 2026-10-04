import {
  RAGE_SCORE_STEEPNESS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  fetchRankingStats,
  rageScores,
  type RankingWindow,
} from '@/lib/rankingStats';

// 클랜원별 종합점수(0~100). team-builder 네임플레이트 점수와 "팀 구성"의 같은 티어 안
// 순서가 같은 값을 써야 화면 순서와 배정 순서가 어긋나지 않는다 — 그래서 한 곳에 둔다.
export async function fetchRageScoreMap(window: RankingWindow): Promise<Record<string, number>> {
  const rows = await fetchRankingStats(window);
  const scored = rageScores(eligibleForRanking(rows), TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS);
  const scores: Record<string, number> = {};
  for (const row of scored) scores[row.memberId] = row.score;
  return scores;
}
