// 미등록으로 저장된 참가자를 뒤늦게 클랜원과 연결한다.
// 사용법: node scripts/relink-participants.mjs
//
// match_participants.member_id 는 저장된 컬럼이라, 나중에 명단에 계정을 추가해도
// 저절로 이어지지 않는다. 명단을 고친 뒤 이 스크립트를 돌리면 과거 경기까지 연결된다.
//
// 폴링이 참가자를 64명 전원 저장하는 이유가 이것이다 — 그때는 누군지 몰라도
// 나중에 밝혀지면 그날 기록이 그대로 살아난다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

// PostgREST 는 한 번에 최대 1000행만 돌려준다.
const PAGE_SIZE = 1000;

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exitCode = 1;
  throw new Error('중단됨');
}

async function selectAll(table, columns, applyFilter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyFilter(supabase.from(table).select(columns)).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) fail(`${table} 조회 실패:`, error);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

const accounts = await selectAll('member_pubg_accounts', 'member_id, pubg_account_id');
const memberIdByAccountId = new Map(
  accounts.filter((a) => a.pubg_account_id).map((a) => [a.pubg_account_id, a.member_id]),
);

const orphans = await selectAll(
  'match_participants',
  'id, pubg_account_id, pubg_ign, pubg_match_id',
  (q) => q.is('member_id', null),
);

console.log(`미연결 참가자 행: ${orphans.length}개`);

const linkable = orphans.filter((o) => memberIdByAccountId.has(o.pubg_account_id));
const stillUnknown = orphans.filter((o) => !memberIdByAccountId.has(o.pubg_account_id));

if (linkable.length === 0) {
  console.log('새로 연결할 수 있는 행이 없다.');
} else {
  // accountId 별로 묶어서 갱신한다 — 한 사람이 여러 경기에 걸쳐 있다.
  const byAccountId = new Map();
  for (const row of linkable) {
    if (!byAccountId.has(row.pubg_account_id)) byAccountId.set(row.pubg_account_id, []);
    byAccountId.get(row.pubg_account_id).push(row);
  }

  for (const [accountId, rows] of byAccountId) {
    const { error } = await supabase
      .from('match_participants')
      .update({ member_id: memberIdByAccountId.get(accountId) })
      .eq('pubg_account_id', accountId)
      .is('member_id', null);
    if (error) fail(`${rows[0].pubg_ign} 연결 실패:`, error);
    console.log(`  ${rows[0].pubg_ign.padEnd(20)} ${rows.length}경기 연결됨`);
  }
  console.log(`\n${linkable.length}개 행을 연결했다.`);
}

// matches.clan_member_count 도 다시 센다 — 판별 근거로 남겨둔 값이라 실제와 맞아야 한다.
if (linkable.length > 0) {
  const affectedMatchIds = [...new Set(linkable.map((r) => r.pubg_match_id))];
  for (const matchId of affectedMatchIds) {
    const rows = await selectAll('match_participants', 'member_id', (q) =>
      q.eq('pubg_match_id', matchId),
    );
    const { error } = await supabase
      .from('matches')
      .update({ clan_member_count: rows.filter((r) => r.member_id).length })
      .eq('pubg_match_id', matchId);
    if (error) fail(`${matchId} 의 clan_member_count 갱신 실패:`, error);
  }
  console.log(`매치 ${affectedMatchIds.length}개의 clan_member_count 를 다시 셌다.`);
}

if (stillUnknown.length > 0) {
  const byIgn = new Map();
  for (const row of stillUnknown) byIgn.set(row.pubg_ign, (byIgn.get(row.pubg_ign) ?? 0) + 1);
  console.log(`\n아직 누구인지 모르는 참가자 ${byIgn.size}명:`);
  for (const [ign, count] of [...byIgn].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ign.padEnd(20)} ${count}경기`);
  }
}
