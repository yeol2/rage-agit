// 손으로 옮겨 적은 IGN 이 실제로 존재하는지 PUBG API 로 확인하고 accountId 를 확보한다.
// 사용법: node scripts/verify-pubg-igns.mjs
//
// 2단계로 진행한다:
//   1차 — 옮겨 적은 이름 그대로 조회. 대부분 여기서 끝난다.
//   2차 — 1차에서 실패한 것만, 혼동 문자를 바꾼 후보들로 다시 조회.
// 이렇게 하면 잘 읽은 이름까지 변형을 만들어 조회하는 낭비가 없다.

import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { chunk, extractAlternates, generateVariants, parseRosterTsv } from './lib/roster.mjs';

loadEnvLocal();
const [apiKey] = requireEnv('PUBG_API_KEY');

const RAW_PATH = 'data/discord-members.raw.tsv';
const VERIFIED_PATH = 'data/verified-igns.tsv';
const FAILED_PATH = 'data/failed-igns.tsv';

const BATCH_SIZE = 10;      // Players 엔드포인트가 한 번에 받는 최대 인원
const REQUEST_INTERVAL = 6500; // 분당 10회 제한 — 6초에 여유를 조금 더한다

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 이름 여러 개를 한 번에 조회하고, 찾은 것만 Map<이름, accountId> 로 돌려준다.
// 하나도 못 찾으면 API 가 404 를 주는데 이건 오류가 아니라 '전부 없음'이다.
async function lookupNames(names) {
  const url =
    `https://api.pubg.com/shards/kakao/players` +
    `?filter[playerNames]=${names.map(encodeURIComponent).join(',')}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' },
  });

  if (res.status === 404) return new Map();

  if (res.status === 429) {
    console.log('  속도 제한에 걸렸다 — 60초 쉬고 다시 시도한다');
    await sleep(60000);
    return lookupNames(names);
  }

  if (!res.ok) {
    console.error(`PUBG API 오류 ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const body = await res.json();
  const found = new Map();
  for (const player of body.data ?? []) {
    // API 가 돌려준 표기가 정답이다 — 우리가 적어 넣은 대소문자를 믿지 않는다.
    found.set(player.attributes.name, player.id);
  }
  return found;
}

// 이름 목록 전체를 배치로 나눠 조회한다.
async function lookupAll(names, label) {
  const batches = chunk(names, BATCH_SIZE);
  const found = new Map();

  for (const [i, batch] of batches.entries()) {
    process.stdout.write(`${label} ${i + 1}/${batches.length} ... `);
    const result = await lookupNames(batch);
    for (const [name, id] of result) found.set(name, id);
    console.log(`${result.size}/${batch.length}명 확인`);

    if (i < batches.length - 1) await sleep(REQUEST_INTERVAL);
  }
  return found;
}

const rows = parseRosterTsv(readFileSync(RAW_PATH, 'utf-8'));
console.log(`원본 ${rows.length}명 읽음\n`);

if (rows.length === 0) {
  console.error(`${RAW_PATH} 에서 한 명도 읽지 못했다 — 파일 형식을 확인할 것`);
  process.exit(1);
}

// --- 1차: 적어놓은 이름 그대로 ---
console.log('1차 조회 (옮겨 적은 이름 그대로)');
const firstPass = await lookupAll(rows.map((r) => r.ignGuess), '  배치');

const verified = [];   // { row, pubgIgn, accountId }
const unresolved = [];  // 1차에서 못 찾은 행

for (const row of rows) {
  const accountId = firstPass.get(row.ignGuess);
  if (accountId) {
    verified.push({ row, pubgIgn: row.ignGuess, accountId });
  } else {
    unresolved.push(row);
  }
}

console.log(`\n1차 결과: 확인 ${verified.length}명, 미확인 ${unresolved.length}명\n`);

// --- 2차: 미확인 건만 후보를 만들어 재조회 ---
const failed = []; // { row, tried, reason }

if (unresolved.length > 0) {
  console.log('2차 조회 (혼동 문자 변형 후보)');

  const candidatesByRow = new Map();
  const allCandidates = new Set();

  for (const row of unresolved) {
    const candidates = generateVariants(row.ignGuess, extractAlternates(row.note));
    candidatesByRow.set(row, candidates);
    for (const candidate of candidates) allCandidates.add(candidate);
  }

  const secondPass =
    allCandidates.size > 0 ? await lookupAll([...allCandidates], '  배치') : new Map();

  for (const row of unresolved) {
    const hits = (candidatesByRow.get(row) ?? []).filter((c) => secondPass.has(c));

    if (hits.length === 1) {
      verified.push({ row, pubgIgn: hits[0], accountId: secondPass.get(hits[0]) });
    } else {
      // 후보가 하나도 없으면 못 찾은 것이고,
      // 둘 이상이면 둘 다 실존하는 다른 사람일 수 있으므로 자동 판정하지 않는다.
      failed.push({
        row,
        tried: candidatesByRow.get(row) ?? [],
        reason: hits.length === 0 ? '조회 실패' : `후보 여러 개 실존: ${hits.join(', ')}`,
      });
    }
  }
  console.log('');
}

// --- accountId 중복 검사 ---
// 서로 다른 IGN 두 개가 같은 accountId 를 가리키면 같은 PUBG 계정이다.
// 0002 의 unique(pubg_account_id) 에 걸려 등록이 실패하므로 미리 걸러낸다.
const byAccountId = new Map();
for (const entry of verified) {
  const existing = byAccountId.get(entry.accountId);
  if (existing) {
    failed.push({
      row: entry.row,
      tried: [entry.pubgIgn],
      reason: `accountId 가 ${existing.pubgIgn} 와 같다 — 같은 PUBG 계정이다`,
    });
  } else {
    byAccountId.set(entry.accountId, entry);
  }
}

const finalVerified = verified.filter((e) => byAccountId.get(e.accountId) === e);

// --- 결과 저장 ---
writeFileSync(
  VERIFIED_PATH,
  finalVerified
    .map((e) =>
      [e.row.tier, e.row.discordUsername, e.row.displayNick, e.pubgIgn, e.accountId].join('\t'),
    )
    .join('\n') + '\n',
  'utf-8',
);

writeFileSync(
  FAILED_PATH,
  failed
    .map((f) =>
      [f.row.tier, f.row.discordUsername, f.row.displayNick, f.row.ignGuess,
       f.tried.join(' '), f.reason].join('\t'),
    )
    .join('\n') + '\n',
  'utf-8',
);

console.log(`확인됨 ${finalVerified.length}명 → ${VERIFIED_PATH}`);
console.log(`확인 실패 ${failed.length}명 → ${FAILED_PATH}`);

for (const f of failed) {
  console.log(`  - ${f.row.displayNick} (${f.row.ignGuess}): ${f.reason}`);
}

if (finalVerified.length === 0) {
  console.error('\n한 명도 확인되지 않았다 — API 키나 샤드 설정을 확인할 것');
  process.exit(1);
}
