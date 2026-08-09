import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 공개 읽기 전용 클라이언트. 서버 렌더링과 브라우저 양쪽에서 쓴다.
//
// anon 키가 브라우저에 노출되는 것은 의도된 것이다 — 무엇을 읽을 수 있는지는
// 0004/0005/0007 에서 컬럼 단위 권한으로 정해뒀다. raw_stats, pubg_account_id,
// discord_username 은 이 키로 읽히지 않는다.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다');
  }

  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}
