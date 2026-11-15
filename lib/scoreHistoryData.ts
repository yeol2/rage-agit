import { unstable_cache } from 'next/cache';
import { getSupabase } from './supabaseBrowser';
import { computeScoreHistory, type RankedGame, type ScoreHistory } from './scoreHistory';

// 점수 이력은 클랜 전체 경기(1만 줄 남짓)를 한 번 다 읽어야 나온다. 리더보드와
// 클랜원 상세 270여 장이 각자 읽으면 빌드 때 같은 조회를 수백 번 하게 되므로,
// 한 번 계산한 결과를 캐시해 모두가 나눠 쓴다.
//
// 점수는 우승 확정 때만 바뀐다(ranked_matches 는 확정된 내전만 센다). 그래서
// 확정이 SCORE_HISTORY_TAG 를 지워 다음 요청이 새로 계산하게 하고, 시간 상한은
// 혹시 놓친 경로를 위한 안전판이다.
export const SCORE_HISTORY_TAG = 'score-history';

const PAGE = 1000; // PostgREST 한 번에 돌려주는 최대 줄 수

async function fetchRankedGames(): Promise<RankedGame[]> {
  const games: RankedGame[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from('member_ranking_games')
      .select('member_id, kills, team_rank, played_at')
      // 페이지가 겹치거나 빠지지 않게 순서를 완전히 고정한다.
      .order('played_at')
      .order('member_id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`점수 이력용 경기 기록을 불러오지 못했습니다: ${error.message}`);
    for (const row of data ?? []) {
      games.push({
        memberId: row.member_id as string,
        kills: row.kills as number,
        teamRank: row.team_rank as number,
        playedAt: row.played_at as string,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return games;
}

async function loadScoreHistory(): Promise<ScoreHistory> {
  const [games, membersResult] = await Promise.all([
    fetchRankedGames(),
    getSupabase().from('members').select('id, tier').eq('is_active', true),
  ]);
  if (membersResult.error) {
    throw new Error(`클랜원 명단을 불러오지 못했습니다: ${membersResult.error.message}`);
  }
  const members = (membersResult.data ?? []).map((m) => ({ id: m.id as string, tier: m.tier as number }));
  return computeScoreHistory(games, members);
}

// v2: 자격 있는 날은 안 뛰어도 점수를 남기도록 모양이 바뀌었다(played 추가) — 예전 캐시와 섞이지 않게.
export const fetchScoreHistory = unstable_cache(loadScoreHistory, ['score-history-v2'], {
  tags: [SCORE_HISTORY_TAG],
  revalidate: 3600,
});
