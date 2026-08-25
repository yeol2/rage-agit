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

console.log('\n0006 — 폴링 자동화');

check(
  (await one(`select count(*) from information_schema.tables
    where table_name = 'polling_runs'`)) === 1,
  'polling_runs 테이블이 있다',
);

for (const ext of ['pg_cron', 'pg_net']) {
  check(
    (await one(`select count(*) from pg_extension where extname = '${ext}'`)) === 1,
    `${ext} 확장이 설치돼 있다`,
  );
}

const runGrants = await client.query(`
  select grantee, column_name
  from information_schema.column_privileges
  where table_name = 'polling_runs' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
check(runGrants.rows.length === 0, 'polling_runs 는 공개로 읽히지 않는다');

console.log('\n0007 — 내전 세션');

check(
  (await one(`select count(*) from information_schema.tables
    where table_name = 'scrim_sessions'`)) === 1,
  'scrim_sessions 테이블이 있다',
);
check(
  (await one(`select count(*) from information_schema.views
    where table_name = 'scrim_session_summary'`)) === 1,
  'scrim_session_summary 뷰가 있다',
);
check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'scrim_session_id'`)) === 1,
  'matches.scrim_session_id 컬럼이 있다',
);
for (const col of ['walk_distance', 'ride_distance']) {
  check(
    (await one(`select count(*) from information_schema.columns
      where table_name = 'match_participants' and column_name = '${col}'`)) === 1,
    `match_participants.${col} 컬럼이 있다`,
  );
}

const sessionGrants = await client.query(`
  select grantee, column_name
  from information_schema.column_privileges
  where table_name in ('scrim_sessions', 'matches', 'match_participants')
    and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated')
`);
for (const role of ['anon', 'authenticated']) {
  const columns = sessionGrants.rows.filter((r) => r.grantee === role).map((r) => r.column_name);
  check(columns.includes('scrim_date'), `${role} 이 scrim_date 를 읽을 수 있다`);
  check(columns.includes('walk_distance'), `${role} 이 walk_distance 를 읽을 수 있다`);
  check(!columns.includes('raw_stats'), `${role} 이 raw_stats 는 여전히 못 읽는다`);
}

console.log('\n0008 — dak.gg 출처를 받기 위한 스키마 변경');

const nullable = async (table, column) =>
  (
    await client.query(
      `select is_nullable from information_schema.columns
        where table_name = $1 and column_name = $2`,
      [table, column],
    )
  ).rows[0]?.is_nullable;

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'source'`)) === 1,
  'matches.source 컬럼이 있다',
);

check(
  (await one(`select count(*) from matches where source is null`)) === 0,
  '기존 매치의 source 가 전부 채워져 있다',
);

for (const column of ['heals', 'boosts', 'revives', 'pubg_account_id']) {
  check(
    (await nullable('match_participants', column)) === 'YES',
    `match_participants.${column} 이 nullable 이다`,
  );
}

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'match_participants' and column_name = 'total_distance'`)) === 1,
  'match_participants.total_distance 컬럼이 있다',
);

check(
  (await one(`select count(*) from pg_indexes
    where tablename = 'match_participants' and indexname = 'match_participants_ign_uniq'`)) === 1,
  '같은 경기에 같은 닉네임을 막는 유니크 인덱스가 있다',
);

// 0009 — 부분 인덱스는 ON CONFLICT 대상이 못 되어 적재가 막힌다.
check(
  !(
    await client.query(`select indexdef from pg_indexes
      where indexname = 'match_participants_ign_uniq'`)
  ).rows[0]?.indexdef.includes('WHERE'),
  '그 인덱스가 부분 인덱스가 아니다 (upsert 대상이 되어야 한다)',
);

// 뷰가 NULL 계정 ID 를 빼먹지 않는지는 정의문에서 확인한다.
check(
  (await client.query(`select pg_get_viewdef('scrim_session_summary'::regclass) as def`)).rows[0].def
    .toUpperCase()
    .includes('COALESCE'),
  'scrim_session_summary 가 참가자를 셀 때 닉네임으로 대체한다',
);

// 새 컬럼이 열려 있지 않으면 프론트에서 조용히 안 읽힌다.
const newColumnGrants = await client.query(`
  select grantee, table_name, column_name
  from information_schema.column_privileges
  where privilege_type = 'SELECT' and grantee in ('anon', 'authenticated')
    and ((table_name = 'matches' and column_name = 'source')
      or (table_name = 'match_participants' and column_name = 'total_distance'))
`);
for (const role of ['anon', 'authenticated']) {
  const granted = newColumnGrants.rows.filter((r) => r.grantee === role).map((r) => r.column_name);
  check(granted.includes('source'), `${role} 이 matches.source 를 읽을 수 있다`);
  check(granted.includes('total_distance'), `${role} 이 total_distance 를 읽을 수 있다`);
}

console.log('\n0010 — 사람별 최근 10경기 집계 뷰');

check(
  (await one(`select count(*) from information_schema.views
    where table_name = 'member_recent_stats'`)) === 1,
  'member_recent_stats 뷰가 있다',
);

const statsGrants = await client.query(`
  select grantee from information_schema.table_privileges
  where table_name = 'member_recent_stats' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
const statsGrantees = statsGrants.rows.map((r) => r.grantee);
check(statsGrantees.includes('anon'), 'anon 이 member_recent_stats 를 읽을 수 있다');
check(
  statsGrantees.includes('authenticated'),
  'authenticated 이 member_recent_stats 를 읽을 수 있다',
);

// 뷰가 최근 10경기로 제한하는지는 정의문에서 확인한다 — rn <= 10 이 없으면
// 전체 경기가 다 들어가 평균이 조용히 틀어진다.
check(
  (await client.query(`select pg_get_viewdef('member_recent_stats'::regclass) as def`)).rows[0].def
    .includes('<= 10'),
  '뷰가 최근 10경기로 제한한다',
);

console.log('\n0011 — 등수+킬 랭킹용 통산 집계와 배치 점수');

// 0011 은 member_recent_stats 에도 avg_placement_points 를 넣었지만, 0012 가
// 그 칸을 member_recent_ranking_stats 로 옮기고 여기서는 뺐다 — 한 출처만 세는
// 배치 점수가 남아 있으면 랭킹이 쓰는 값과 조용히 어긋난다.
// 그래서 '빠져 있는지'는 아래 0012 절에서 확인한다.

check(
  (await one(`select count(*) from information_schema.views
    where table_name = 'member_alltime_stats'`)) === 1,
  'member_alltime_stats 뷰가 있다',
);

const alltimeGrants = await client.query(`
  select grantee from information_schema.table_privileges
  where table_name = 'member_alltime_stats' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
const alltimeGrantees = alltimeGrants.rows.map((r) => r.grantee);
check(alltimeGrantees.includes('anon'), 'anon 이 member_alltime_stats 를 읽을 수 있다');
check(
  alltimeGrantees.includes('authenticated'),
  'authenticated 이 member_alltime_stats 를 읽을 수 있다',
);

check(
  !(await client.query(`select pg_get_viewdef('member_alltime_stats'::regclass) as def`)).rows[0].def
    .includes('<= 10'),
  'member_alltime_stats 는 최근10 제한 없이 전체 경기를 본다',
);

console.log('\n0012 — 스크린샷 출처 내전 결과와 두 출처를 합친 랭킹 뷰');

check(
  (await one(`select count(*) from information_schema.tables
    where table_name = 'scrim_screenshot_results'`)) === 1,
  'scrim_screenshot_results 테이블이 있다',
);

check(
  (await one(`select count(*) from pg_proc where proname = 'placement_points'`)) === 1,
  '배치 점수표가 placement_points 함수 하나로 모여 있다',
);

// 점수표가 실제로 의도한 값을 내는지 — 뷰 정의문만 보면 오타를 못 잡는다.
const points = (
  await client.query(`
    select array_agg(placement_points(r) order by r) as pts
    from generate_series(1, 9) as r
  `)
).rows[0].pts.map(Number);
check(
  JSON.stringify(points) === JSON.stringify([10, 6, 5, 4, 3, 2, 1, 1, 0]),
  `placement_points 가 10/6/5/4/3/2/1/1/0 을 낸다 (실제: ${points.join('/')})`,
);

for (const view of ['member_ranking_games', 'member_recent_ranking_stats']) {
  check(
    (await one(`select count(*) from information_schema.views
      where table_name = '${view}'`)) === 1,
    `${view} 뷰가 있다`,
  );
}

// 두 출처를 실제로 잇는지는 정의문에서 확인한다 — union 이 빠지면 스크린샷
// 백필이 통째로 랭킹에서 빠지는데, 화면은 조용히 잘 도는 것처럼 보인다.
check(
  (await client.query(`select pg_get_viewdef('member_ranking_games'::regclass) as def`)).rows[0].def
    .includes('scrim_screenshot_results'),
  'member_ranking_games 가 스크린샷 출처를 함께 센다',
);

for (const view of ['member_alltime_stats', 'member_recent_ranking_stats']) {
  const grants = await client.query(`
    select grantee from information_schema.table_privileges
    where table_name = '${view}' and privilege_type = 'SELECT'
      and grantee in ('anon', 'authenticated')
  `);
  const grantees = grants.rows.map((r) => r.grantee);
  for (const role of ['anon', 'authenticated']) {
    check(grantees.includes(role), `${role} 이 ${view} 를 읽을 수 있다`);
  }
}

// 6각형 뷰는 한 출처만 봐야 한다 — 데미지가 없는 스크린샷 경기가 최근 10경기에
// 끼면 지표가 조용히 흐려진다.
const recentDef = (
  await client.query(`select pg_get_viewdef('member_recent_stats'::regclass) as def`)
).rows[0].def;
check(
  !recentDef.includes('scrim_screenshot_results'),
  '6각형용 member_recent_stats 는 스크린샷 출처를 섞지 않는다',
);
check(
  !recentDef.includes('placement_points'),
  'member_recent_stats 에 랭킹과 어긋나는 배치 점수 칸이 남아 있지 않다',
);

console.log('\n0016 — 팀 구성 테이블: 명단 업로드 롤');

for (const table of ['scrim_rosters', 'scrim_roster_entries']) {
  check(
    (await one(`select count(*) from information_schema.tables where table_name = '${table}'`)) === 1,
    `${table} 테이블이 있다`,
  );
}

const rosterEntryGrants = await client.query(`
  select grantee, column_name from information_schema.column_privileges
  where table_name = 'scrim_roster_entries' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
for (const role of ['anon', 'authenticated']) {
  const cols = rosterEntryGrants.rows.filter((r) => r.grantee === role).map((r) => r.column_name);
  check(!cols.includes('discord_username'), `${role} 은 scrim_roster_entries.discord_username 을 못 읽는다`);
  check(cols.includes('discord_nickname'), `${role} 은 scrim_roster_entries.discord_nickname 을 읽을 수 있다`);
}

console.log('\n0017 — 클랜원 VIP 등수');

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'members' and column_name = 'vip_rank'`)) === 1,
  'members.vip_rank 컬럼이 있다',
);
check(
  (await one(`select count(*) from pg_indexes
    where tablename = 'members' and indexname = 'members_clan_vip_rank_key'`)) === 1,
  'vip_rank 에 유일 인덱스가 걸려 있다',
);

const memberVipGrants = await client.query(`
  select grantee, column_name from information_schema.column_privileges
  where table_name = 'members' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
for (const role of ['anon', 'authenticated']) {
  const cols = memberVipGrants.rows.filter((r) => r.grantee === role).map((r) => r.column_name);
  check(cols.includes('vip_rank'), `${role} 은 members.vip_rank 를 읽을 수 있다`);
}

console.log('\n0018 — 팀 구성 테이블: 팀 번호');

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'scrim_roster_entries' and column_name = 'team_number'`)) === 1,
  'scrim_roster_entries.team_number 컬럼이 있다',
);

const teamNumberGrants = await client.query(`
  select grantee, column_name from information_schema.column_privileges
  where table_name = 'scrim_roster_entries' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated') and column_name = 'team_number'
`);
for (const role of ['anon', 'authenticated']) {
  check(
    teamNumberGrants.rows.some((r) => r.grantee === role),
    `${role} 은 scrim_roster_entries.team_number 를 읽을 수 있다`,
  );
}

console.log('\n0019 — 팀 구성 테이블: 고정(fix)');

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'scrim_roster_entries' and column_name = 'fixed'`)) === 1,
  'scrim_roster_entries.fixed 컬럼이 있다',
);

const fixedGrants = await client.query(`
  select grantee, column_name from information_schema.column_privileges
  where table_name = 'scrim_roster_entries' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated') and column_name = 'fixed'
`);
for (const role of ['anon', 'authenticated']) {
  check(
    fixedGrants.rows.some((r) => r.grantee === role),
    `${role} 은 scrim_roster_entries.fixed 를 읽을 수 있다`,
  );
}

console.log('\n0025 — 03 내전 시트의 진행 상태(stage)를 도로 없앴다');

// 0020 이 넣었던 컬럼을 0025 가 지웠다 — 01/02/03 이 전부 항상 보이는 구조가
// 되면서 "몇 단계까지 왔는지" 를 기억할 이유가 사라졌기 때문이다. 그래서 이건
// "있어야 한다" 가 아니라 "없어야 한다" 로 확인한다.
check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'scrim_rosters' and column_name = 'stage'`)) === 0,
  'scrim_rosters.stage 컬럼이 없다',
);

console.log('\n0021 — 최근 랭킹 창 12매치 → 16매치');

check(
  (await client.query(`select pg_get_viewdef('member_recent_ranking_stats'::regclass) as def`)).rows[0].def
    .includes('<= 16'),
  '뷰가 최근 16경기로 제한한다',
);

console.log('\n0022 — 등수 스냅샷');

check(
  (await one(`select count(*) from information_schema.tables
    where table_name = 'ranking_snapshots'`)) === 1,
  'ranking_snapshots 테이블이 있다',
);

check(
  (await one(`select count(*) from pg_constraint
    where conrelid = 'ranking_snapshots'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%ranking_window%group_id%member_id%'`)) === 1,
  '(ranking_window, group_id, member_id) 유일 제약이 있다',
);

const snapshotGrants = await client.query(`
  select grantee from information_schema.role_table_grants
  where table_name = 'ranking_snapshots' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
`);
for (const role of ['anon', 'authenticated']) {
  check(
    snapshotGrants.rows.some((r) => r.grantee === role),
    `${role} 은 ranking_snapshots 를 읽을 수 있다`,
  );
}

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'scrim_rosters' and column_name = 'ranking_snapshot_captured_at'`)) === 1,
  'scrim_rosters.ranking_snapshot_captured_at 컬럼이 있다',
);

console.log('\n0023 — 합 킬 30 이하 매치를 랭킹 집계에서 제외');

check(
  (await client.query(`select pg_get_viewdef('member_ranking_games'::regclass) as def`)).rows[0].def
    .includes('sum(mp.kills) > 30'),
  '뷰가 합 킬 30 이하 매치를 걸러낸다',
);

console.log('\n0024 — 세션 참여 인원을 계정이 아니라 사람 기준으로');

check(
  (await client.query(`select pg_get_viewdef('scrim_session_summary'::regclass) as def`)).rows[0].def
    .includes('p.member_id'),
  '뷰가 participant_count 에서 member_id 를 우선 쓴다',
);

console.log('\n0026 — 재경기를 매치 단위로 표시하고 집계에서 뺀다');

check(
  (await one(`select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'excluded_reason'`)) === 1,
  'matches.excluded_reason 컬럼이 있다',
);

const excludedGrants = await client.query(`
  select grantee from information_schema.column_privileges
  where table_name = 'matches' and column_name = 'excluded_reason'
    and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated')
`);
for (const role of ['anon', 'authenticated']) {
  check(
    excludedGrants.rows.some((r) => r.grantee === role),
    `${role} 은 matches.excluded_reason 을 읽을 수 있다`,
  );
}

for (const view of ['member_ranking_games', 'scrim_session_summary']) {
  check(
    (await client.query(`select pg_get_viewdef($1::regclass) as def`, [view])).rows[0].def.includes(
      'excluded_reason IS NULL',
    ),
    `${view} 가 제외 표시된 매치를 걸러낸다`,
  );
}

// 2026-08-16 재경기가 실제로 표시돼 있는지 본다. 뷰만 고치고 데이터를
// 안 건드리면 화면에는 그대로 5경기로 남는다.
check(
  (await one(`select count(*) from matches
    where pubg_match_id = 'caa76fed-7219-4bd3-8077-075e02221197'
      and excluded_reason is not null`)) === 1,
  '2026-08-16 재경기가 제외 표시돼 있다',
);

await client.end();

console.log('');
if (problems.length > 0) {
  console.error(`스키마 검증 실패 ${problems.length}건`);
  process.exitCode = 1;
} else {
  console.log('스키마 검증 통과');
}
