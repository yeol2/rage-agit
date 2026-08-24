declare module '@/supabase/functions/_shared/polling.mjs' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  export function runPolling(args: {
    supabase: SupabaseClient;
    apiKey: string;
    sinceHours?: number;
    maxMatches?: number;
    playerRetries?: number;
    log?: (message: string) => void;
    knownAccountId?: string | null;
  }): Promise<{
    seedsUsed: number;
    matchesExamined: number;
    scrimsFound: number;
    scrims: Array<{ playedAt: string; participantCount: number; clanMemberCount: number }>;
    // pubgIgn → 그 IGN으로 발견된 미등록 참가 횟수 (scripts/poll-matches.mjs 가
    // 등록 안내를 출력할 때 씀 — 실제 반환값은 polling.mjs 의 result.unregistered 참고).
    unregistered: Map<string, number>;
    truncated: boolean;
    failedFetches: number;
  }>;
}
