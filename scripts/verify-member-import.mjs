// 등록 결과를 자동으로 검사한다.
// 사용법: node scripts/verify-member-import.mjs
//
// Phase 1 리뷰에서 '검증 스크립트가 정작 검증해야 할 상황에서 실패하지 못했다'는
// 지적을 받았다. 그래서 이 스크립트는 조건이 깨지면 반드시 exit 1 로 끝난다.
// 읽기만 하므로 anon 키로 충분하다 — 공개 읽기 정책이 살아있는지도 함께 확인되는 셈이다.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, anonKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(url, anonKey);

const problems = [];
const check = (condition, message) => {
  if (condition) console.log(`  OK  ${message}`);
  else {
    console.log(`  실패 ${message}`);
    problems.push(message);
  }
};

// 기대값은 검증 단계 산출물에서 가져온다 — 숫자를 코드에 박아두면 금방 낡는다.
const expected = readFileSync('data/verified-igns.tsv', 'utf-8')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => {
    const [tier, discordUsername, , pubgIgn] = line.split('\t');
    return { tier: Number(tier), discordUsername, pubgIgn };
  });

const { data: members, error } = await supabase
  .from('members')
  .select('id, discord_username, discord_nickname, tier, is_active, member_pubg_accounts(pubg_ign, pubg_account_id)');
if (error) {
  console.error('members 조회 실패:', error.message);
  process.exit(1);
}

console.log(`등록된 members: ${members.length}명 (기대: ${expected.length}명)\n`);

check(members.length === expected.length, `members 행 수가 ${expected.length}명과 일치한다`);

check(
  members.every((m) => m.discord_username),
  '모든 members 행에 discord_username 이 채워져 있다',
);

// 티어 분포 대조
const actualTiers = {};
for (const m of members) actualTiers[m.tier] = (actualTiers[m.tier] ?? 0) + 1;
const expectedTiers = {};
for (const e of expected) expectedTiers[e.tier] = (expectedTiers[e.tier] ?? 0) + 1;

for (const tier of Object.keys(expectedTiers).sort((a, b) => a - b)) {
  check(
    actualTiers[tier] === expectedTiers[tier],
    `${tier}티어 인원이 ${expectedTiers[tier]}명이다 (실제 ${actualTiers[tier] ?? 0}명)`,
  );
}

// 검증된 IGN 이 전부 들어갔는지
const registeredIgns = new Set(members.flatMap((m) => m.member_pubg_accounts.map((a) => a.pubg_ign)));
const missing = expected.filter((e) => !registeredIgns.has(e.pubgIgn));
check(
  missing.length === 0,
  `검증된 IGN 이 모두 등록됐다${missing.length ? ` (누락: ${missing.map((m) => m.pubgIgn).join(', ')})` : ''}`,
);

// 우리가 등록한 IGN 에만 accountId 를 요구한다.
// 관리자가 Table Editor 로 손수 넣은 부계정은 비어 있는 게 정상이다 —
// 폴링이 매치에서 그 IGN 을 만나면 그때 채워진다.
const expectedIgns = new Set(expected.map((e) => e.pubgIgn));
const importedAccounts = members
  .flatMap((m) => m.member_pubg_accounts)
  .filter((a) => expectedIgns.has(a.pubg_ign));
const withoutAccountId = importedAccounts.filter((a) => !a.pubg_account_id);
check(
  withoutAccountId.length === 0,
  `등록한 IGN 에 pubg_account_id 가 모두 채워져 있다${
    withoutAccountId.length ? ` (누락: ${withoutAccountId.map((a) => a.pubg_ign).join(', ')})` : ''
  }`,
);

// 손으로 넣은 부계정이 살아있는지 — 등록 스크립트가 남의 행을 안 건드렸다는 증거
const ezCode = members.find((m) => m.member_pubg_accounts.some((a) => a.pubg_ign === 'Ez_Code'));
check(
  ezCode !== undefined && ezCode.member_pubg_accounts.some((a) => a.pubg_ign === 'Ez_Codu'),
  'Ez_Code 가 여전히 부계정 Ez_Codu 를 갖고 있다 (기존 데이터 보존)',
);

console.log('');
if (problems.length > 0) {
  console.error(`검증 실패 ${problems.length}건`);
  // process.exit() 를 여기서 부르면 출력이 아직 흘러가는 중이라
  // Windows 에서 libuv 어서션이 터지고 종료 코드가 127 로 뒤바뀐다.
  // 종료 코드만 정해두고 자연스럽게 끝나게 둔다.
  process.exitCode = 1;
} else {
  console.log('검증 통과');
}
