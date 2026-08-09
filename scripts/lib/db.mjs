// Supabase Postgres 에 직접 붙는다.
//
// service_role 키는 PostgREST 를 거치므로 DDL 이나 카탈로그 조회를 할 수 없다.
// 그래서 SUPABASE_DATABASE_PASSWORD 로 Postgres 에 직접 연결한다.
// 이 비밀번호는 service_role 키보다도 강한 권한이므로 값을 절대 출력하지 않는다.

import pg from 'pg';
import { requireEnv } from './env.mjs';

export async function connectPostgres() {
  const [supabaseUrl, dbPassword] = requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_DATABASE_PASSWORD',
  );

  // https://<ref>.supabase.co → <ref>
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

  // 직접 연결(db.<ref>.supabase.co)은 프로젝트에 따라 IPv6 전용이라 실패할 수 있다.
  // 실제로 이 프로젝트가 그래서, 늘 두 번째 후보로 붙는다.
  // (트랜잭션 모드 6543 포트가 아니라 세션 모드 5432 를 쓴다 — DDL 에 안전하다)
  const candidates = [
    {
      label: '직접 연결',
      config: {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: 'postgres',
      },
    },
    {
      label: '세션 풀러',
      config: {
        host: 'aws-0-ap-southeast-1.pooler.supabase.com',
        port: 5432,
        user: `postgres.${projectRef}`,
      },
    },
  ];

  const failures = [];
  for (const { label, config } of candidates) {
    const client = new pg.Client({
      ...config,
      password: dbPassword,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      console.log(`Postgres 연결 성공 (${label})`);
      return client;
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      await client.end().catch(() => {});
    }
  }

  console.error('Postgres 연결 실패:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
