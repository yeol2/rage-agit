declare module '@/supabase/functions/_shared/polling.mjs' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  export function runPolling(args: {
    supabase: SupabaseClient;
    apiKey: string;
    sinceHours?: number;
    maxMatches?: number;
    playerRetries?: number;
    log?: (message: string) => void;
  }): Promise<{
    matchesExamined: number;
    scrimsFound: number;
    scrims: Array<{ playedAt: string; participantCount: number; clanMemberCount: number }>;
  }>;
}
