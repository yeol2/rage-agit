// 클랜원의 부계정을 본계정과 같은 사람으로 묶는다.
// 사용법: node scripts/link-alt-account.mjs <본계정IGN> <부계정IGN>
//   예:   node scripts/link-alt-account.mjs Ez_Xavi- Ez_Xapaz-
//
// 폴링이 내놓는 "등록되지 않은 참가자" 목록을 처리하는 도구다.
// 거기 뜨는 사람은 대개 외부인이 아니라 부계정으로 뛴 우리 클랜원이다.
//
// 부계정의 accountId 는 match_participants 에 이미 저장돼 있으므로 거기서 가져온다.
// 내전에 나온 적 없는 계정이면 PUBG API 로 조회한다.
//
// 붙인 뒤에는 scripts/relink-participants.mjs 를 돌려야 과거 경기 기록이 연결된다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, serviceRoleKey, apiKey] = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBG_API_KEY',
);
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const [mainIgn, altIgn] = process.argv.slice(2);
if (!mainIgn || !altIgn) {
  console.error('사용법: node scripts/link-alt-account.mjs <본계정IGN> <부계정IGN>');
  process.exitCode = 1;
  process.exit();
}

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exitCode = 1;
  throw new Error('중단됨');
}

// --- 본계정이 누구인지 ---
const { data: main, error: mainError } = await supabase
  .from('member_pubg_accounts')
  .select('member_id, members(discord_nickname)')
  .eq('pubg_ign', mainIgn)
  .maybeSingle();
if (mainError) fail('본계정 조회 실패:', mainError);
if (!main) fail(`본계정 ${mainIgn} 이 등록돼 있지 않다`);

// --- 부계정이 이미 붙어 있는지 ---
const { data: existing, error: existingError } = await supabase
  .from('member_pubg_accounts')
  .select('member_id, members(discord_nickname)')
  .eq('pubg_ign', altIgn)
  .maybeSingle();
if (existingError) fail('부계정 조회 실패:', existingError);

if (existing) {
  if (existing.member_id === main.member_id) {
    console.log(`이미 붙어 있다: ${main.members.discord_nickname} ← ${altIgn}`);
    process.exit();
  }
  fail(
    `${altIgn} 이 다른 사람(${existing.members.discord_nickname})에게 붙어 있다. ` +
      '먼저 그 연결을 확인할 것',
  );
}

// --- 부계정의 accountId 찾기 ---
// 내전에 나온 적이 있으면 참가자 기록에 이미 들어 있다.
const { data: seen, error: seenError } = await supabase
  .from('match_participants')
  .select('pubg_account_id')
  .eq('pubg_ign', altIgn)
  .limit(1)
  .maybeSingle();
if (seenError) fail('참가자 기록 조회 실패:', seenError);

let accountId = seen?.pubg_account_id;

if (!accountId) {
  console.log(`${altIgn} 이 내전 기록에 없다 — PUBG API 로 조회한다`);
  const res = await fetch(
    `https://api.pubg.com/shards/kakao/players?filter[playerNames]=${encodeURIComponent(altIgn)}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' } },
  );
  if (res.status === 404) fail(`${altIgn} 이라는 플레이어를 찾을 수 없다 (대소문자를 확인할 것)`);
  if (!res.ok) fail(`PUBG API 오류 ${res.status}`);
  accountId = (await res.json()).data?.[0]?.id;
  if (!accountId) fail(`${altIgn} 의 accountId 를 얻지 못했다`);
}

// --- 붙이기 ---
const { error: insertError } = await supabase
  .from('member_pubg_accounts')
  .insert({ member_id: main.member_id, pubg_ign: altIgn, pubg_account_id: accountId });
if (insertError) fail('부계정 추가 실패:', insertError);

console.log(`${main.members.discord_nickname}: ${mainIgn} + ${altIgn} (부계정)`);
console.log('과거 경기 기록을 연결하려면 node scripts/relink-participants.mjs 를 돌릴 것');
