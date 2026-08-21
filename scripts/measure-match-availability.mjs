// 매치가 끝난 뒤 정확히 몇 분/초 만에 PUBG API로 조회 가능해지는지 측정한다.
//
// 기존 폴링(scripts/poll-matches.mjs)은 씨앗 후보 30명을 훑는 방식이라 "누가
// 그 매치에 나왔는지" 모른 채로 넓게 찾는다. 하지만 내전은 01/02/03을 거쳐
// 참가자 64명이 이미 확정돼 있으므로, 그중 1명만 고정 씨앗으로 삼아 그
// 사람의 Players 응답(matches 목록)에 새 matchId가 뜨는 순간만 감시하면 된다
// — 훨씬 적은 호출로 훨씬 정확하게 측정할 수 있다.
//
// 사용법: node scripts/measure-match-availability.mjs <닉네임 또는 IGN 일부>
//   예: node scripts/measure-match-availability.mjs heungmini
//   매치 시작 전(또는 진행 중)에 미리 실행해두고, 매치가 끝나길 기다리면 된다.
//
// Players 엔드포인트는 분당 10회 제한(실측, docs/superpowers/pubg-api-reference.md) —
// 여기서는 계정 1개만 조회하므로 7초 간격(분당 ~8.6회)이면 여유 있게 안전하다.
// Matches(상세) 엔드포인트는 제한이 없으므로(실측) 새 matchId를 찾은 뒤에는
// 바로 이어서 상세를 조회해도 된다.

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [apiKey] = requireEnv('PUBG_API_KEY');

const POLL_INTERVAL_MS = 7000;

const query = process.argv[2];
if (!query) {
  console.error('사용법: node scripts/measure-match-availability.mjs <닉네임 또는 IGN 일부>');
  process.exit(1);
}

const c = await connectPostgres();
const { rows } = await c.query(
  `select m.discord_nickname, mpa.pubg_ign, mpa.pubg_account_id
   from member_pubg_accounts mpa
   join members m on m.id = mpa.member_id
   where mpa.pubg_ign ilike $1 or m.discord_nickname ilike $1
   limit 5`,
  [`%${query}%`],
);
await c.end();

if (rows.length === 0) {
  console.error(`"${query}" 로 클랜원을 찾지 못했다.`);
  process.exit(1);
}
if (rows.length > 1) {
  console.error(`"${query}" 로 ${rows.length}명이 매칭됐다 — 더 구체적으로 입력할 것:`);
  for (const r of rows) console.error(`  ${r.discord_nickname} (${r.pubg_ign})`);
  process.exit(1);
}

const { discord_nickname: nickname, pubg_ign: ign, pubg_account_id: accountId } = rows[0];
console.log(`씨앗: ${nickname} (${ign}, ${accountId})`);

async function fetchMatchIds() {
  const res = await fetch(
    `https://api.pubg.com/shards/kakao/players?filter[playerIds]=${accountId}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' } },
  );
  if (res.status === 429) {
    console.log('  속도 제한(429) — 60초 쉬고 계속 감시한다');
    await new Promise((r) => setTimeout(r, 60000));
    return fetchMatchIds();
  }
  if (!res.ok) throw new Error(`Players 조회 실패: ${res.status}`);
  const body = await res.json();
  const player = body.data?.[0];
  return new Set((player?.relationships?.matches?.data ?? []).map((m) => m.id));
}

async function fetchMatchSummary(matchId) {
  const res = await fetch(`https://api.pubg.com/shards/kakao/matches/${matchId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' },
  });
  if (!res.ok) throw new Error(`Matches 조회 실패: ${res.status}`);
  const body = await res.json();
  const a = body.data.attributes;
  return { playedAt: a.createdAt, durationSeconds: a.duration, mapName: a.mapName };
}

console.log(`베이스라인 매치 목록을 가져오는 중...`);
const baseline = await fetchMatchIds();
console.log(`베이스라인 ${baseline.size}건 확보. ${POLL_INTERVAL_MS / 1000}초 간격으로 새 매치를 감시한다.`);
console.log('새 매치가 뜬 뒤 이 씨앗으로 뛴 매치라면 잡힌다 — Ctrl+C로 중단할 수 있다.\n');

const startedAt = Date.now();
let checkCount = 0;

for (;;) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  checkCount++;
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);

  const current = await fetchMatchIds();
  const newIds = [...current].filter((id) => !baseline.has(id));

  if (newIds.length === 0) {
    console.log(`  [${checkCount}회, ${elapsedMin}분 경과] 아직 새 매치 없음`);
    continue;
  }

  const detectedAt = new Date();
  console.log(`\n새 매치 발견! (${checkCount}회째 확인, 감시 시작 후 ${elapsedMin}분)`);
  for (const matchId of newIds) {
    const summary = await fetchMatchSummary(matchId);
    const playedAt = new Date(summary.playedAt);
    const matchEnd = new Date(playedAt.getTime() + summary.durationSeconds * 1000);
    const lagSeconds = (detectedAt - matchEnd) / 1000;
    console.log(`  matchId: ${matchId}`);
    console.log(`  맵: ${summary.mapName}`);
    console.log(`  매치 시작(UTC): ${playedAt.toISOString()}  진행시간: ${summary.durationSeconds}초`);
    console.log(`  매치 종료(추정, UTC): ${matchEnd.toISOString()}`);
    console.log(`  최초 감지 시각(UTC): ${detectedAt.toISOString()}`);
    console.log(`  => 매치 종료부터 API 조회 가능까지: ${(lagSeconds / 60).toFixed(2)}분 (${lagSeconds.toFixed(0)}초)\n`);
  }

  process.exit(0);
}
