// 클랜 내전 매치를 PUBG API 에서 수집해 Supabase 에 저장한다.
// 사용법: node scripts/poll-matches.mjs [--since-hours=24] [--max-matches=200]
//
// 자동 실행은 Edge Function 이 담당한다(매주 목·일 한국시간 23:00).
// 이 스크립트는 세 가지 용도로 남아 있다:
//   - 자동 실행이 실패했을 때 기간을 넓혀 만회하기 (--since-hours=336 이면 14일)
//   - 실데이터로 디버깅하기
//   - 배포한 함수가 로컬과 같은 결과를 내는지 대조하기
//
// 로직은 Edge Function 과 같은 파일(supabase/functions/_shared/polling.mjs)을 쓴다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { runPolling } from '../supabase/functions/_shared/polling.mjs';

loadEnvLocal();
const [apiKey, url, serviceRoleKey] = requireEnv(
  'PUBG_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
);

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function numericArg(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${name} 값이 올바르지 않다: ${raw}`);
    process.exitCode = 1;
    throw new Error('중단됨');
  }
  return value;
}

const sinceHours = numericArg('since-hours', 24);
const maxMatches = numericArg('max-matches', 200);

console.log(`되돌아보기 ${sinceHours}시간, 매치 상한 ${maxMatches}건\n`);

let result;
try {
  result = await runPolling({
    supabase,
    apiKey,
    sinceHours,
    maxMatches,
    playerRetries: 5, // 로컬은 시간 제한이 없어 여러 번 시도해도 된다
    log: (message) => console.log(message),
  });
} catch (error) {
  console.error(`\n폴링 실패: ${error.message}`);
  process.exitCode = 1;
  throw new Error('중단됨');
}

console.log(`\n매치 ${result.matchesExamined}건 확인, 내전 ${result.scrimsFound}경기 저장`);
for (const s of result.scrims) {
  console.log(`  ${s.playedAt}  ${s.participantCount}명 (클랜원 ${s.clanMemberCount})`);
}
if (result.failedFetches > 0) console.log(`조회 실패 ${result.failedFetches}건 (건너뜀)`);
if (result.truncated) {
  console.log(`상한 ${maxMatches}건에 걸려 멈췄다 — 다시 실행하면 이어받는다`);
}

if (result.unregistered.size > 0) {
  console.log(`\n등록되지 않은 참가자 ${result.unregistered.size}명:`);
  for (const [ign, count] of [...result.unregistered].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ign.padEnd(20)} ${count}경기`);
  }
  console.log('\nnode scripts/link-alt-account.mjs <본계정IGN> <부계정IGN> 으로 붙인 뒤');
  console.log('node scripts/relink-participants.mjs 를 돌리면 과거 기록까지 연결된다.');
}
