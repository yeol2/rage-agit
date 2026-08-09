// 스키마가 마이그레이션이 의도한 상태인지 확인한다.
// 사용법: node scripts/verify-schema.mjs
//
// 마이그레이션이 '에러 없이 돌았다'는 것과 '의도대로 됐다'는 것은 다르다.
// drop constraint if exists 는 제약 이름을 잘못 짚어도 조용히 성공하고,
// grant/revoke 는 순서를 틀리면 아무것도 안 가려진다.
// 그래서 실제 상태를 카탈로그에서 읽어 확인한다.

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';

loadEnvLocal();

const client = await connectPostgres();

const problems = [];
const check = (condition, message) => {
  if (condition) console.log(`  OK  ${message}`);
  else {
    console.log(`  실패 ${message}`);
    problems.push(message);
  }
};

const one = async (sql) => Number((await client.query(sql)).rows[0].count);

console.log('\n0003 — 사람 식별을 별명에서 디스코드 사용자명으로 옮김');

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'members' and column_name = 'discord_username'`)) === 1,
  'members.discord_username 컬럼이 있다',
);

check(
  (await one(`select count(*) from pg_indexes
    where tablename = 'members' and indexname = 'members_clan_discord_username_key'`)) === 1,
  'discord_username 에 유일 인덱스가 걸려 있다',
);

check(
  (await one(`select count(*) from pg_constraint
    where conrelid = 'members'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%discord_nickname%'`)) === 0,
  'discord_nickname 의 유일 제약이 제거됐다',
);

check(
  (await one(`select count(*) from pg_constraint
    where conrelid = 'members'::regclass and conname = 'members_tier_valid'`)) === 1,
  'tier 값 범위 체크 제약이 있다',
);

console.log('\n0004 — discord_username 을 공개 읽기에서 제외');

const publicColumns = await client.query(`
  select grantee, column_name
  from information_schema.column_privileges
  where table_name = 'members' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);

for (const role of ['anon', 'authenticated']) {
  const columns = publicColumns.rows.filter((r) => r.grantee === role).map((r) => r.column_name);

  check(
    !columns.includes('discord_username'),
    `${role} 이 discord_username 을 못 읽는다`,
  );
  check(
    columns.includes('discord_nickname') && columns.includes('tier'),
    `${role} 이 discord_nickname 과 tier 는 읽을 수 있다 (대시보드가 필요로 한다)`,
  );
}

console.log('\n기존 마이그레이션 (0001/0002)');

check(
  (await one(`select count(*) from pg_constraint
    where conrelid = 'member_pubg_accounts'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%pubg_account_id%'`)) === 1,
  'pubg_account_id 에 유일 제약이 있다',
);

check(
  (await one(`select count(*) from pg_trigger
    where tgrelid = 'members'::regclass and tgname = 'members_set_updated_at'`)) === 1,
  'members 의 updated_at 갱신 트리거가 있다',
);

console.log('\n0005 — 매치 폴링 테이블');

for (const table of ['matches', 'match_participants', 'polled_matches']) {
  check(
    (await one(`select count(*) from information_schema.tables
      where table_name = '${table}'`)) === 1,
    `${table} 테이블이 있다`,
  );
}

const matchGrants = await client.query(`
  select grantee, column_name
  from information_schema.column_privileges
  where table_name in ('matches', 'match_participants', 'polled_matches')
    and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated')
`);

for (const role of ['anon', 'authenticated']) {
  const columns = matchGrants.rows.filter((r) => r.grantee === role).map((r) => r.column_name);
  check(!columns.includes('raw_attributes'), `${role} 이 matches.raw_attributes 를 못 읽는다`);
  check(!columns.includes('raw_stats'), `${role} 이 match_participants.raw_stats 를 못 읽는다`);
  check(!columns.includes('pubg_account_id'), `${role} 이 pubg_account_id 를 못 읽는다`);
  check(
    columns.includes('team_rank') && columns.includes('kills'),
    `${role} 이 team_rank 와 kills 는 읽을 수 있다 (대시보드가 필요로 한다)`,
  );
}

await client.end();

console.log('');
if (problems.length > 0) {
  console.error(`스키마 검증 실패 ${problems.length}건`);
  process.exitCode = 1;
} else {
  console.log('스키마 검증 통과');
}
