import { getSupabaseServer } from '@/lib/supabaseServer';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';
import { rankEntries, type ReactionRankEntry } from '@/lib/reaction';

// 서버 전용 — reaction_records 는 anon 키로 못 읽는다(0049).

interface RecordRow {
  member_id: string;
  best_avg_ms: number;
  best_single_ms: number;
  attempts: number;
  achieved_at: string;
  members: { discord_nickname: string; tier: number } | null;
}

export async function fetchReactionRanking(): Promise<ReactionRankEntry[]> {
  const { data, error } = await getSupabaseServer()
    .from('reaction_records')
    .select('member_id, best_avg_ms, best_single_ms, attempts, achieved_at, members(discord_nickname, tier)')
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
      })),
  );
}
