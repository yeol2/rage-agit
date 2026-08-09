// 검증된 클랜원 명단을 Supabase 에 등록한다.
// 사용법: node scripts/import-members.mjs
//
// RLS 가 쓰기를 막고 있으므로 service_role 키로 우회한다.
// 이 키는 모든 RLS 를 무시하므로 서버 스크립트에서만 쓰고, 값을 출력하지 않는다.
//
// 여러 번 돌려도 결과가 같아야 한다 — 검증 실패를 고쳐 재실행하는 일이 반복되기 때문이다.
// 그래서 '이 사람이 이미 있는가'를 IGN 으로 확인한 뒤 갱신/삽입을 결정한다.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
);

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exit(1);
}

// --- 입력 읽기 ---
const rows = readFileSync('data/verified-igns.tsv', 'utf-8')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => {
    const [tier, discordUsername, displayNick, pubgIgn, pubgAccountId] = line.split('\t');
    return { tier: Number(tier), discordUsername, displayNick, pubgIgn, pubgAccountId };
  });

if (rows.length === 0) fail('data/verified-igns.tsv 가 비어 있다 — 먼저 검증을 돌릴 것');
console.log(`검증된 ${rows.length}명 읽음`);

// discord_username 이 겹치면 upsert 가 같은 행을 두 번 건드리게 되어
// "ON CONFLICT DO UPDATE command cannot affect row a second time" 로 실패한다.
// 원본 TSV 를 손으로 고치다 보면 생길 수 있으므로 먼저 확인한다.
const usernameCounts = new Map();
for (const row of rows) {
  usernameCounts.set(row.discordUsername, (usernameCounts.get(row.discordUsername) ?? 0) + 1);
}
const duplicated = [...usernameCounts].filter(([, count]) => count > 1);
if (duplicated.length > 0) {
  fail(`discord_username 이 중복된다: ${duplicated.map(([name]) => name).join(', ')}`);
}

// --- 클랜 확인 ---
const { data: clans, error: clanError } = await supabase.from('clans').select('id, name');
if (clanError) fail('clans 조회 실패:', clanError);
if (clans.length !== 1) {
  fail(`clans 가 ${clans.length}개다 — 어느 클랜에 넣을지 알 수 없다. 정확히 1개여야 한다.`);
}
const clanId = clans[0].id;
console.log(`대상 클랜: ${clans[0].name}`);

// --- 이미 등록된 IGN → member_id 매핑 ---
// 이게 '이 사람이 이미 있는가'를 판단하는 기준이다.
// pubg_ign 에는 유일 제약이 있어 정확히 매칭된다.
const { data: existingAccounts, error: accountsError } = await supabase
  .from('member_pubg_accounts')
  .select('member_id, pubg_ign');
if (accountsError) fail('member_pubg_accounts 조회 실패:', accountsError);

const memberIdByIgn = new Map(existingAccounts.map((a) => [a.pubg_ign, a.member_id]));
console.log(`이미 등록된 IGN: ${existingAccounts.length}개`);

// --- 1) 기존 사람에게 discord_username 을 채워 넣는다 ---
// Phase 1 에 등록된 사람들은 이 값이 비어 있어서, 채워주지 않으면
// 아래 upsert 가 같은 사람을 새로 만들어 버린다.
let linked = 0;
for (const row of rows) {
  const memberId = memberIdByIgn.get(row.pubgIgn);
  if (!memberId) continue;

  const { error } = await supabase
    .from('members')
    .update({ discord_username: row.discordUsername })
    .eq('id', memberId)
    .is('discord_username', null);
  if (error) fail(`${row.pubgIgn} 의 discord_username 연결 실패:`, error);
  linked++;
}
console.log(`기존 등록자와 대조: ${linked}명`);

// --- 2) members upsert ---
// 0003 에서 만든 (clan_id, discord_username) 유일 인덱스를 충돌 기준으로 쓴다.
const memberRows = rows.map((row) => ({
  clan_id: clanId,
  discord_username: row.discordUsername,
  discord_nickname: row.displayNick,
  tier: row.tier,
  is_active: true,
}));

const { error: memberError } = await supabase
  .from('members')
  .upsert(memberRows, { onConflict: 'clan_id,discord_username' });
if (memberError) fail('members upsert 실패:', memberError);
console.log(`members upsert 완료: ${memberRows.length}건`);

// --- 3) member_id 를 다시 읽어 IGN 과 연결한다 ---
const { data: members, error: readError } = await supabase
  .from('members')
  .select('id, discord_username')
  .eq('clan_id', clanId);
if (readError) fail('members 재조회 실패:', readError);

const memberIdByUsername = new Map(members.map((m) => [m.discord_username, m.id]));

const accountRows = rows.map((row) => {
  const memberId = memberIdByUsername.get(row.discordUsername);
  if (!memberId) fail(`${row.discordUsername} 의 member_id 를 찾지 못했다 — upsert 가 누락됐다`);
  return {
    member_id: memberId,
    pubg_ign: row.pubgIgn,
    pubg_account_id: row.pubgAccountId,
  };
});

// pubg_ign 유일 제약을 충돌 기준으로 쓴다.
// verified-igns.tsv 에 없는 IGN(부계정 Ez_Codu 등)은 여기 안 들어오므로 건드려지지 않는다.
const { error: accountError } = await supabase
  .from('member_pubg_accounts')
  .upsert(accountRows, { onConflict: 'pubg_ign' });
if (accountError) fail('member_pubg_accounts upsert 실패:', accountError);
console.log(`member_pubg_accounts upsert 완료: ${accountRows.length}건`);

console.log('\n등록 완료. node scripts/verify-member-import.mjs 로 확인할 것');
