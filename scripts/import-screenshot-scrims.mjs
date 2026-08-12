// 디스코드 결과 스크린샷에서 읽은 내전을 scrim_screenshot_results 에 넣는다.
// 사용법: node scripts/import-screenshot-scrims.mjs [--dry-run] [파일.json ...]
//         (파일을 안 주면 data/screenshot-scrims/*.json 전부)
//
// (scrim_date, round_no, pubg_ign) 이 유일 키라서 여러 번 돌려도 행이 안 늘어난다.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { buildIgnResolver, buildRows, crossCheck, validateFile } from './lib/screenshot-scrims.mjs';

const DIR = 'data/screenshot-scrims';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const given = args.filter((a) => !a.startsWith('--'));
const paths =
  given.length > 0
    ? given
    : existsSync(DIR)
      ? readdirSync(DIR)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => join(DIR, f))
      : [];

if (paths.length === 0) {
  console.error(`${DIR} 에 JSON 이 없다 — scripts/read-screenshot-guide.md 를 볼 것`);
  process.exit(1);
}

// 형식 오류와 대조 실패는 스택 트레이스가 아니라 한 줄씩 보여준다 —
// 이 메시지를 읽고 JSON 을 고치는 게 이 스크립트의 절반이다.
function readAndCheck(path) {
  let file;
  try {
    file = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    console.error(`${path} 를 읽지 못했다: ${error.message}`);
    process.exit(1);
  }
  try {
    validateFile(file);
  } catch (error) {
    console.error(`${path}\n  ${error.message}`);
    process.exit(1);
  }

  const problems = crossCheck(file);
  if (problems.length > 0) {
    console.error(`${path} — 시트와 인게임이 어긋난다 (${problems.length}건)`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n어느 쪽을 잘못 읽었는지 이미지를 다시 볼 것. 대조가 맞아야 넣는다.');
    process.exit(1);
  }
  return file;
}

if (dryRun) {
  for (const path of paths) {
    const file = readAndCheck(path);
    const players = new Set(
      file.matches.flatMap((m) => m.teams.flatMap((t) => t.players.map((p) => p.ign))),
    );
    console.log(
      `OK  ${path} — ${file.scrimDate}, ${file.matches.length}경기, ${players.size}명, 시트 대조 통과`,
    );
  }
  console.log('\n형식과 대조만 검사했다. 적재하려면 --dry-run 없이 다시 돌릴 것.');
  process.exit(0);
}

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exit(1);
}

const { data: accounts, error: accountError } = await supabase
  .from('member_pubg_accounts')
  .select('pubg_ign, member_id');
if (accountError) fail('member_pubg_accounts 조회 실패:', accountError);

// 부계정은 member_pubg_accounts 가 1:N 이라 여기서 자동으로 같은 사람이 된다
// (Ez_ekrtm 과 Ez_Daks 는 같은 member_id 다). 따로 합칠 것이 없다.
const resolve = buildIgnResolver(
  accounts.map((a) => ({ pubgIgn: a.pubg_ign, memberId: a.member_id })),
);
console.log(`닉네임 대응 ${accounts.length}개`);

let inserted = 0;
const unknownIgns = new Set();

for (const path of paths) {
  const file = readAndCheck(path);
  console.log(`\n${path} — ${file.scrimDate}`);

  // 같은 날이 matches 에도 있으면 member_ranking_games 가 그날을 두 번 센다
  // (0012 의 union). API/dak.gg 쪽이 데미지까지 있는 풍부한 데이터라 그쪽을 남긴다.
  const { data: sameDay, error: sameDayError } = await supabase
    .from('matches')
    .select('pubg_match_id')
    .gte('played_at', `${file.scrimDate}T00:00:00+09:00`)
    .lte('played_at', `${file.scrimDate}T23:59:59+09:00`);
  if (sameDayError) fail('기존 매치 조회 실패:', sameDayError);
  if (sameDay.length > 0) {
    console.log(
      `  건너뜀 — 이 날은 이미 matches 에 ${sameDay.length}경기가 있다 (API/dak.gg 출처).`,
    );
    console.log('  넣으면 랭킹이 같은 경기를 두 번 센다.');
    continue;
  }

  const rows = buildRows(file, resolve);
  for (const row of rows) {
    if (!row.member_id) unknownIgns.add(row.pubg_ign);
  }

  const { error: upsertError } = await supabase
    .from('scrim_screenshot_results')
    .upsert(rows, { onConflict: 'scrim_date,round_no,pubg_ign' });
  if (upsertError) fail('적재 실패:', upsertError);

  const known = rows.filter((r) => r.member_id).length;
  console.log(`  ${file.matches.length}경기 · ${rows.length}행 (클랜원 ${known}, 미확인 ${rows.length - known})`);
  inserted += rows.length;
}

console.log(`\n총 ${inserted}행 적재`);

if (resolve.ambiguous.size > 0) {
  console.log(`\n대소문자만 지우면 여러 사람에 걸리는 닉네임 ${resolve.ambiguous.size}개 — 비워뒀다:`);
  for (const ign of [...resolve.ambiguous].sort()) console.log(`  ${ign}`);
  console.log('  scripts/link-alt-account.mjs 로 어느 사람인지 정해줄 것.');
}

if (unknownIgns.size > 0) {
  console.log(`\n클랜원과 안 엮인 닉네임 ${unknownIgns.size}개 (랭킹에서는 그냥 빠진다):`);
  for (const ign of [...unknownIgns].sort()) console.log(`  ${ign}`);
  console.log('\n탈퇴자면 data/departed-members.tsv 에, 부계정/개명이면 link-alt-account.mjs 로.');
  console.log('절차는 scripts/verify-dakgg-import.mjs 실행 결과에 적혀 있다.');
}
