// data/departed-members.tsv 에 적힌 탈퇴자를 match_participants 에서 지운다.
// 사용법: node scripts/apply-departed-members.mjs
//
// 이 목록이 있는 이유: 새 dak.gg 내전을 넣을 때마다 "이 사람 탈퇴했나요?"를
// 관리자에게 매번 묻지 않으려는 것이다. 한 번 확인된 사람은 여기 남고,
// 다음에 같은 닉네임이 미확인으로 뜨면 이 스크립트가 조용히 정리한다.
//
// member_id 가 이미 붙어 있는 행은 절대 안 건드린다 — 닉네임만 우연히
// 같은 진짜 클랜원의 기록을 지우는 사고를 막는다.

import { readFileSync } from 'node:fs';
import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';

const PATH = 'data/departed-members.tsv';

function readDepartedIgns() {
  let content;
  try {
    content = readFileSync(PATH, 'utf-8');
  } catch {
    console.error(`${PATH} 가 없다 — 아직 탈퇴자를 기록한 적이 없다는 뜻이다.`);
    process.exit(1);
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>'))
    .map((line) => line.split('\t')[0].trim());
}

loadEnvLocal();
const client = await connectPostgres();

const igns = readDepartedIgns();
console.log(`탈퇴자 목록: ${igns.length}명`);

const del = await client.query(
  `delete from match_participants
     where pubg_ign = any($1) and member_id is null
     returning pubg_ign, pubg_match_id`,
  [igns],
);

console.log(`삭제된 행: ${del.rowCount}`);
if (del.rowCount > 0) {
  const byIgn = new Map();
  for (const row of del.rows) {
    byIgn.set(row.pubg_ign, (byIgn.get(row.pubg_ign) ?? 0) + 1);
  }
  for (const [ign, count] of byIgn) {
    console.log(`  ${ign.padEnd(20)} ${count}행`);
  }
}

await client.end();
console.log('\n삭제된 행이 있었다면 node scripts/verify-dakgg-import.mjs 로 확인할 것.');
