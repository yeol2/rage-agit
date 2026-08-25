// 매치 해석·판별 로직은 Edge Function 과 공유한다.
// 실제 구현은 supabase/functions/_shared/matches.mjs 에 있다 —
// Deno 가 함수 폴더 밖을 배포에 포함하지 않으므로 그쪽이 원본이어야 한다.

export {
  MIN_CLAN_RATIO,
  MIN_TOTAL_KILLS,
  classifyMatch,
  extractMatchSummary,
  extractParticipants,
  totalKills,
} from '../../supabase/functions/_shared/matches.mjs';
