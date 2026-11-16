import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';
import { rankEntries, type ReactionRankEntry } from '@/lib/reaction';

// 서버 전용 — reaction_records 는 anon 키로 못 읽는다(0049).
//
// Next 는 서버에서 부르는 fetch 응답을 데이터 캐시에 저장한다. 공용 getSupabaseServer() 로 읽으면
// 페이지가 force-dynamic 이어도 랭킹이 처음 읽은 값(배포 때 값)에 굳는다 — 실제로 운영에서 다른
// 사람이 등록해도 화면엔 첫 기록만 보였다(2026-11-16). 그래서 lib/scrimRoster 처럼 fetch 에
// no-store 를 강제한 service role 클라이언트를 따로 쓴다. 등록 라우트도 이걸 써야 "기존 최고 기록"을
// 캐시된 옛 값으로 비교하는 일이 없다.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: 'no-store' });
}

let freshClient: SupabaseClient | null = null;
export function getReactionSupabase(): SupabaseClient {
  if (freshClient) return freshClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다');
  }
  freshClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
  return freshClient;
}

interface RecordRow {
  member_id: string;
  best_avg_ms: number;
  best_single_ms: number;
  attempts: number;
  achieved_at: string;
  comment: string | null;
  best_times: number[] | null;
  members: { discord_nickname: string; tier: number } | null;
}

export async function fetchReactionRanking(): Promise<ReactionRankEntry[]> {
  const { data, error } = await getReactionSupabase()
    .from('reaction_records')
    .select('member_id, best_avg_ms, best_single_ms, attempts, achieved_at, comment, best_times, members(discord_nickname, tier)')
    .order('best_avg_ms')
    .order('achieved_at')
    .limit(100);
  if (error) throw new Error(`반응속도 랭킹을 읽지 못했습니다: ${error.message}`);

  return rankEntries(
    ((data ?? []) as unknown as RecordRow[])
      .filter((row) => row.members)
      .map((row) => ({
        memberId: row.member_id,
        name: stripTrailingKoreanTag(cleanDisplayName(row.members!.discord_nickname)),
        tier: Number(row.members!.tier),
        bestAvgMs: row.best_avg_ms,
        bestSingleMs: row.best_single_ms,
        attempts: row.attempts,
        achievedAt: row.achieved_at,
        comment: row.comment,
        bestTimes: row.best_times,
      })),
  );
}
