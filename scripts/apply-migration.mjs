// 마이그레이션 SQL 파일을 Supabase Postgres 에 직접 적용한다.
// 사용법: node scripts/apply-migration.mjs supabase/migrations/0003_member_identity.sql
//
// service_role 키는 PostgREST 를 거치므로 alter table 같은 DDL 을 실행할 수 없다.
// 그래서 SUPABASE_DATABASE_PASSWORD 로 Postgres 에 직접 붙는다.
// 이 비밀번호는 service_role 키보다도 강한 권한이므로 값을 절대 출력하지 않는다.

import { readFileSync } from 'node:fs';
import pg from 'pg';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('사용법: node scripts/apply-migration.mjs <마이그레이션.sql>');
  process.exit(1);
}

const [supabaseUrl, dbPassword] = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_DATABASE_PASSWORD',
);

// https://<ref>.supabase.co → <ref>
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

// 직접 연결(db.<ref>.supabase.co)은 프로젝트에 따라 IPv6 전용이라 실패할 수 있다.
// 그 경우 IPv4 로 붙는 세션 모드 풀러로 넘어간다.
// (트랜잭션 모드 6543 포트가 아니라 세션 모드 5432 를 쓴다 — DDL 에 안전하다)
const candidates = [
  {
    label: '직접 연결',
    config: {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: dbPassword,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: '세션 풀러',
    config: {
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${projectRef}`,
      password: dbPassword,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
];

async function connect() {
  const failures = [];
  for (const { label, config } of candidates) {
    const client = new pg.Client(config);
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

const client = await connect();
const sql = readFileSync(sqlPath, 'utf-8');

try {
  // 마이그레이션 전체를 한 트랜잭션으로 — 중간에 실패하면 아무것도 남지 않는다.
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log(`적용 완료: ${sqlPath}`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`적용 실패: ${error.message}`);
  await client.end();
  process.exit(1);
}

// 적용 결과를 실제로 확인한다.
// drop constraint if exists 는 이름이 틀려도 조용히 넘어가므로,
// 지워졌다고 가정하지 않고 조회해서 확인한다.
const checks = await client.query(`
  select
    (select count(*) from information_schema.columns
      where table_name = 'members' and column_name = 'discord_username') as has_username_column,
    (select count(*) from pg_indexes
      where tablename = 'members' and indexname = 'members_clan_discord_username_key') as has_username_index,
    (select count(*) from pg_constraint
      where conrelid = 'members'::regclass and contype = 'u'
        and pg_get_constraintdef(oid) like '%discord_nickname%') as nickname_unique_left,
    (select count(*) from pg_constraint
      where conrelid = 'members'::regclass and conname = 'members_tier_valid') as has_tier_check
`);

const row = checks.rows[0];
await client.end();

const problems = [];
if (Number(row.has_username_column) !== 1) problems.push('discord_username 컬럼이 없다');
if (Number(row.has_username_index) !== 1) problems.push('discord_username 유일 인덱스가 없다');
if (Number(row.nickname_unique_left) !== 0) {
  problems.push('discord_nickname 유일 제약이 아직 남아 있다 — 제약 이름을 확인할 것');
}
if (Number(row.has_tier_check) !== 1) problems.push('tier 체크 제약이 없다');

if (problems.length > 0) {
  console.error('\n적용 후 검사 실패:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('적용 후 검사 통과: 컬럼/인덱스/제약이 모두 의도대로다');
