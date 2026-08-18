import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// service role 키는 모든 RLS/컬럼 권한을 무시한다.
// 절대 브라우저로 안 나가는 서버 코드(API 라우트, 서버 전용 스크립트)에서만 import 할 것 —
// 클라이언트 컴포넌트나 'use client' 파일에서 이 모듈을 import 하면 안 된다.

let client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다');
  }

  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}
