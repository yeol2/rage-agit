// 마이그레이션 SQL 파일을 Supabase Postgres 에 적용한다.
// 사용법: node scripts/apply-migration.mjs supabase/migrations/0004_restrict_discord_username.sql
//
// 이 스크립트는 '적용'만 한다. 적용됐다는 것과 의도대로 됐다는 것은 다르므로
// (drop constraint if exists 는 이름이 틀려도 조용히 넘어간다),
// 스키마가 실제로 어떤 상태인지는 verify-schema.mjs 가 따로 확인한다.

import { readFileSync } from 'node:fs';
import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';

loadEnvLocal();

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('사용법: node scripts/apply-migration.mjs <마이그레이션.sql>');
  process.exit(1);
}

const client = await connectPostgres();
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

await client.end();
console.log('스키마 상태는 node scripts/verify-schema.mjs 로 확인할 것');
