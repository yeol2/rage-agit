// 플레이어의 최근 매치들을 전부 조회해서 matchType 분포를 확인하고,
// 커스텀 매치가 있으면 그 매치의 구조를 자세히 출력한다.
//
// 사용법: node scripts/inspect-matches.mjs <카카오_플레이어_닉네임>
//
// 참고: /matches 엔드포인트는 공식 문서상 rate limit 예외 대상이지만,
// 그래도 불필요하게 남발하지 않도록 목록에 있는 매치만 순회한다.

import { readFileSync, writeFileSync } from 'node:fs';

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
    // ignore
  }
}

loadEnvLocal();

const apiKey = process.env.PUBG_API_KEY;
const playerName = process.argv[2];

if (!apiKey || !playerName) {
  console.error('사용법: node scripts/inspect-matches.mjs <플레이어_닉네임>');
  process.exit(1);
}

async function pubgFetch(path) {
  const res = await fetch(`https://api.pubg.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

// 1. 플레이어 조회 -> 매치 ID 목록
const playerBody = await pubgFetch(
  `/shards/kakao/players?filter[playerNames]=${encodeURIComponent(playerName)}`
);
const player = playerBody.data[0];
const matchIds = player.relationships.matches.data.map((m) => m.id);
console.log(`플레이어 ${playerName}, 매치 ${matchIds.length}개 조회 시작...\n`);

// 2. 각 매치 상세 조회 -> matchType, createdAt 만 뽑기
const summaries = [];
for (const id of matchIds) {
  const body = await pubgFetch(`/shards/kakao/matches/${id}`);
  const attrs = body.data.attributes;
  summaries.push({
    id,
    matchType: attrs.matchType,
    createdAt: attrs.createdAt,
    mapName: attrs.mapName,
    gameMode: attrs.gameMode,
  });
  process.stdout.write('.');
}
console.log('\n');

// 3. matchType 별 개수 집계
const counts = {};
for (const s of summaries) counts[s.matchType] = (counts[s.matchType] ?? 0) + 1;
console.log('matchType 분포:', counts);

console.log('\n전체 목록 (최신순):');
for (const s of summaries) {
  console.log(`  ${s.createdAt}  ${s.matchType.padEnd(10)} ${s.gameMode.padEnd(10)} ${s.mapName}`);
}

// 4. custom 매치가 있으면 그 중 하나를 자세히 저장
const customMatch = summaries.find((s) => s.matchType === 'custom');
if (customMatch) {
  console.log(`\n커스텀 매치 발견: ${customMatch.id} — 상세 구조를 match-sample.json으로 저장합니다.`);
  const full = await pubgFetch(`/shards/kakao/matches/${customMatch.id}`);
  writeFileSync('scripts/match-sample.json', JSON.stringify(full, null, 2));
} else {
  console.log('\n커스텀 매치가 없습니다. 일반 매치 하나를 match-sample.json으로 저장합니다.');
  const full = await pubgFetch(`/shards/kakao/matches/${summaries[0].id}`);
  writeFileSync('scripts/match-sample.json', JSON.stringify(full, null, 2));
}
console.log('저장 완료: scripts/match-sample.json');
