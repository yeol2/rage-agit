// PUBG API 연결 테스트 스크립트.
// 사용법: node scripts/test-pubg-api.mjs <카카오_플레이어_닉네임>
//
// .env.local 의 PUBG_API_KEY 를 읽어서 실제로 호출해본다.
// 목적: 인증이 되는지, kakao 샤드에서 플레이어를 찾을 수 있는지,
// 최근 매치 목록에 matchType 이 어떻게 찍히는지 눈으로 확인하는 것.

import { readFileSync } from 'node:fs';

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
    // .env.local 이 없으면 무시하고 진행 (환경변수로 직접 넘겼을 수도 있으니)
  }
}

loadEnvLocal();

const apiKey = process.env.PUBG_API_KEY;
const playerName = process.argv[2];

if (!apiKey) {
  console.error('PUBG_API_KEY가 비어 있습니다. .env.local에 키를 넣어주세요.');
  process.exit(1);
}
if (!playerName) {
  console.error('사용법: node scripts/test-pubg-api.mjs <카카오_플레이어_닉네임>');
  process.exit(1);
}

const url = `https://api.pubg.com/shards/kakao/players?filter[playerNames]=${encodeURIComponent(playerName)}`;

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
  },
});

console.log('상태 코드:', res.status);

const body = await res.json();

if (!res.ok) {
  console.log('에러 응답:', JSON.stringify(body, null, 2));
  process.exit(1);
}

const player = body.data?.[0];
if (!player) {
  console.log('플레이어를 찾지 못했습니다. 응답:', JSON.stringify(body, null, 2));
  process.exit(1);
}

const matchIds = (player.relationships?.matches?.data ?? []).map((m) => m.id);

console.log('플레이어:', player.attributes?.name);
console.log('accountId:', player.id);
console.log('최근 매치 개수:', matchIds.length);
console.log('매치 ID 예시 (최대 3개):', matchIds.slice(0, 3));
