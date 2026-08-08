// Supabase 스키마 검증 스크립트.
// 사용법: node scripts/verify-supabase-schema.mjs
//
// .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 읽어서
// clans/members/member_pubg_accounts 가 실제로 조회되는지, 특히 한 사람이
// 여러 PUBG IGN을 가진 케이스가 제대로 묶이는지 확인한다.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const content = readFileSync('.env.local', 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local이 없으면 무시 (환경변수로 직접 넘겼을 수도 있음)
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('.env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data: clans, error: clansError } = await supabase.from('clans').select('*');
if (clansError) {
  console.error('clans 조회 실패:', clansError.message);
  process.exit(1);
}
console.log(`clans: ${clans.length}개`);
for (const clan of clans) {
  console.log(`  - ${clan.name} (${clan.id})`);
}

const { data: members, error: membersError } = await supabase
  .from('members')
  .select('id, discord_nickname, tier, is_active, member_pubg_accounts(pubg_ign, pubg_account_id)');
if (membersError) {
  console.error('members 조회 실패:', membersError.message);
  process.exit(1);
}

console.log(`\nmembers: ${members.length}명`);
for (const member of members) {
  const igns = member.member_pubg_accounts.map((a) => a.pubg_ign).join(', ');
  console.log(`  - ${member.discord_nickname} (티어 ${member.tier}) — IGN: ${igns || '(없음)'}`);
}

const multiIgnMembers = members.filter((m) => m.member_pubg_accounts.length > 1);
console.log(`\n여러 IGN을 가진 멤버: ${multiIgnMembers.length}명`);
for (const m of multiIgnMembers) {
  console.log(`  - ${m.discord_nickname}: ${m.member_pubg_accounts.map((a) => a.pubg_ign).join(', ')}`);
}
