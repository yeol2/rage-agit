// 클랜 내전 매치를 PUBG API 에서 수집해 Supabase 에 저장한다.
// 사용법: node scripts/poll-matches.mjs
//
// 인자:
//   --seed=Ez_Code,Ez_gjsl   참가 기록이 없는 첫 실행에서 씨앗을 직접 지정한다
//   --seed-all               등록된 전원을 훑는다 (느리다)
//
// 흐름:
//   1. 씨앗 선정 — 최근 30일 내전에 자주 나온 클랜원 20명 (기록이 없으면 --seed 필요)
//   2. Players API 로 그들의 최근 matchId 수집
//   3. 아직 안 살펴본 matchId 만 Matches API 로 조회
//   4. 내전 판별 — 등록 클랜원 비율
//   5. 저장 + 미등록 참가자 리포트
//
// 관전 계정은 씨앗으로 쓸 수 없다 — 관전은 매치 기록을 남기지 않는다(실측).
// 그래서 실제로 뛴 클랜원을 통해서만 matchId 를 얻을 수 있다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { chunk } from './lib/roster.mjs';
import { classifyMatch, extractMatchSummary, extractParticipants } from './lib/matches.mjs';

loadEnvLocal();
const [apiKey, url, serviceRoleKey] = requireEnv(
  'PUBG_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
);

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const SEED_LIMIT = 20;
const SEED_WINDOW_DAYS = 30;
const BATCH_SIZE = 10; // Players 엔드포인트가 한 번에 받는 최대 인원
const REQUEST_INTERVAL = 6500; // 분당 10회 제한 — 6초에 여유를 더한다

const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 최상위 모듈에서는 return 으로 빠져나올 수 없어 예외를 던져 멈춘다.
// 실제 사유는 이미 출력했으므로 예외 메시지는 짧게 둔다.
function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exitCode = 1;
  throw new Error('중단됨');
}

// PostgREST 는 한 번에 최대 1000행만 돌려준다.
// 실측: polled_matches 가 2371행인데 select 로는 1000행만 왔고, 그래서
// 이미 살펴본 매치를 다시 조회하는 일이 생겼다. 전부 필요한 조회는 나눠 받는다.
const PAGE_SIZE = 1000;

async function selectAll(table, columns, applyFilter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyFilter(supabase.from(table).select(columns)).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) fail(`${table} 조회 실패:`, error);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// --- 등록된 클랜원 계정 ---
const accounts = await selectAll('member_pubg_accounts', 'member_id, pubg_ign, pubg_account_id');

const memberIdByAccountId = new Map(
  accounts.filter((a) => a.pubg_account_id).map((a) => [a.pubg_account_id, a.member_id]),
);
console.log(`등록된 클랜원 계정: ${memberIdByAccountId.size}개`);

if (memberIdByAccountId.size === 0) {
  fail('등록된 계정이 없다 — 먼저 클랜원 등록을 마칠 것');
}

// --- 1. 씨앗 선정 ---
// 최근 내전에 자주 나온 사람일수록 다음 내전에도 나올 가능성이 높다.
// 명단을 사람이 관리하지 않는 게 핵심이다 — 손으로 정해두면 그 사람들이
// 탈퇴하거나 한동안 안 나올 때 조용히 망가진다.
const since = new Date(Date.now() - SEED_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

const recentMatches = await selectAll(
  'matches',
  'pubg_match_id, match_participants(pubg_account_id, member_id)',
  (q) => q.gte('played_at', since),
);

const attendance = new Map();
for (const match of recentMatches) {
  for (const p of match.match_participants ?? []) {
    if (!p.member_id) continue; // 미등록 참가자는 씨앗으로 쓰지 않는다
    attendance.set(p.pubg_account_id, (attendance.get(p.pubg_account_id) ?? 0) + 1);
  }
}

const seedArg = process.argv.find((a) => a.startsWith('--seed='))?.slice('--seed='.length);
const seedAll = process.argv.includes('--seed-all');

let seedAccountIds;
if (attendance.size > 0) {
  seedAccountIds = [...attendance.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEED_LIMIT)
    .map(([accountId]) => accountId);
  console.log(`씨앗: 최근 ${SEED_WINDOW_DAYS}일 내전 참가 상위 ${seedAccountIds.length}명`);
} else if (seedArg) {
  // 첫 실행 — 참가 기록이 없으니 사람이 아는 참석자를 지정한다.
  const accountIdByIgn = new Map(accounts.map((a) => [a.pubg_ign, a.pubg_account_id]));
  const names = seedArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = names.filter((n) => !accountIdByIgn.get(n));
  if (missing.length > 0) {
    fail(`--seed 에 등록되지 않은 IGN 이 있다: ${missing.join(', ')}`);
  }
  seedAccountIds = names.map((n) => accountIdByIgn.get(n));
  console.log(`씨앗: 직접 지정한 ${seedAccountIds.length}명 (${names.join(', ')})`);
} else if (seedAll) {
  seedAccountIds = [...memberIdByAccountId.keys()];
  console.log(`씨앗: 등록된 ${seedAccountIds.length}명 전원`);
} else {
  // 여기서 조용히 전원을 훑지 않는 이유: 매치가 수천 건이 되어 10분 넘게 걸리는데,
  // 정작 최근 내전에 나온 사람 한 명만 알면 몇 초로 끝난다.
  // 반대로 아무나 몇 명 골라 넣으면 그들이 안 나온 내전을 조용히 놓친다.
  // 어느 쪽도 자동으로 정할 수 없으므로 사람에게 묻는다.
  fail(
    '참가 기록이 없어 씨앗을 정할 수 없다.\n' +
      '  최근 내전에 나온 클랜원을 지정할 것: node scripts/poll-matches.mjs --seed=Ez_Code\n' +
      '  누가 나왔는지 모르면 전원을 훑을 것(10분 이상): node scripts/poll-matches.mjs --seed-all',
  );
}

// --- 2. matchId 수집 ---
// 닉네임이 아니라 accountId 로 조회한다 — 닉네임은 바뀌지만 accountId 는 안 바뀐다.
async function fetchPlayers(accountIds) {
  const res = await fetch(
    `https://api.pubg.com/shards/kakao/players?filter[playerIds]=${accountIds.join(',')}`,
    { headers },
  );

  if (res.status === 404) return [];
  if (res.status === 429) {
    console.log('  속도 제한에 걸렸다 — 60초 쉬고 다시 시도한다');
    await sleep(60000);
    return fetchPlayers(accountIds);
  }
  if (!res.ok) fail(`Players API 오류 ${res.status}: ${await res.text()}`);

  return (await res.json()).data ?? [];
}

const matchIds = new Set();
const seedBatches = chunk(seedAccountIds, BATCH_SIZE);

for (const [i, batch] of seedBatches.entries()) {
  process.stdout.write(`  배치 ${i + 1}/${seedBatches.length} ... `);
  const players = await fetchPlayers(batch);
  for (const player of players) {
    for (const m of player.relationships?.matches?.data ?? []) matchIds.add(m.id);
  }
  console.log(`누적 matchId ${matchIds.size}개`);

  if (i < seedBatches.length - 1) await sleep(REQUEST_INTERVAL);
}

// --- 3. 이미 살펴본 매치는 건너뛴다 ---
const polled = await selectAll('polled_matches', 'pubg_match_id');
const alreadySeen = new Set(polled.map((r) => r.pubg_match_id));
const newMatchIds = [...matchIds].filter((id) => !alreadySeen.has(id));

console.log(`\nmatchId ${matchIds.size}개 중 새로운 것 ${newMatchIds.length}개\n`);

const scrims = [];
const unregisteredByIgn = new Map(); // 미등록 참가자 IGN → 목격 횟수
let failedFetches = 0;

if (newMatchIds.length === 0) {
  console.log('새 매치가 없다.');
} else {
  // 첫 실행은 씨앗이 많으면 matchId 가 수천 개까지 나올 수 있다.
  // 속도 제한은 없지만 한 건당 수백 ms 라 오래 걸릴 수 있으므로
  // 진행 상황을 주기적으로 찍는다. 다음 실행부터는 polled_matches 덕에 거의 0건이다.
  console.log(`매치 조회 (Matches 엔드포인트는 속도 제한이 없다) — ${newMatchIds.length}건`);
}

// --- 4~5. 판별과 저장 ---
for (const [index, matchId] of newMatchIds.entries()) {
  if (index > 0 && index % 50 === 0) {
    console.log(`  ${index}/${newMatchIds.length} 검사함 (내전 ${scrims.length}경기 발견)`);
  }

  const res = await fetch(`https://api.pubg.com/shards/kakao/matches/${matchId}`, { headers });
  if (!res.ok) {
    // 매치 하나가 실패해도 나머지는 계속한다.
    console.log(`  ${matchId}: 조회 실패 ${res.status} — 건너뛴다`);
    failedFetches++;
    continue;
  }

  const body = await res.json();
  const summary = extractMatchSummary(body);
  const participants = extractParticipants(body, memberIdByAccountId);
  const clanMemberCount = participants.filter((p) => p.memberId).length;
  const verdict = classifyMatch({
    matchType: summary.matchType,
    participantCount: summary.participantCount,
    clanMemberCount,
  });

  const { error: polledInsertError } = await supabase
    .from('polled_matches')
    .upsert(
      { pubg_match_id: matchId, is_scrim: verdict.isScrim, reason: verdict.reason },
      { onConflict: 'pubg_match_id' },
    );
  if (polledInsertError) fail('polled_matches 기록 실패:', polledInsertError);

  if (!verdict.isScrim) continue;

  console.log(`  내전 발견: ${summary.playedAt}  ${verdict.reason}`);

  const { error: matchError } = await supabase.from('matches').upsert(
    {
      pubg_match_id: summary.pubgMatchId,
      played_at: summary.playedAt,
      match_type: summary.matchType,
      game_mode: summary.gameMode,
      map_name: summary.mapName,
      duration_seconds: summary.durationSeconds,
      participant_count: summary.participantCount,
      clan_member_count: clanMemberCount,
      raw_attributes: summary.rawAttributes,
    },
    { onConflict: 'pubg_match_id' },
  );
  if (matchError) fail('matches 저장 실패:', matchError);

  const { error: participantError } = await supabase.from('match_participants').upsert(
    participants.map((p) => ({
      pubg_match_id: summary.pubgMatchId,
      member_id: p.memberId,
      pubg_account_id: p.pubgAccountId,
      pubg_ign: p.pubgIgn,
      team_id: p.teamId,
      team_rank: p.teamRank,
      kills: p.kills,
      assists: p.assists,
      damage_dealt: p.damageDealt,
      dbnos: p.dbnos,
      headshot_kills: p.headshotKills,
      win_place: p.winPlace,
      time_survived: p.timeSurvived,
      heals: p.heals,
      boosts: p.boosts,
      longest_kill: p.longestKill,
      revives: p.revives,
      raw_stats: p.rawStats,
    })),
    { onConflict: 'pubg_match_id,pubg_account_id' },
  );
  if (participantError) fail('match_participants 저장 실패:', participantError);

  scrims.push(summary);
  for (const p of participants.filter((p) => !p.memberId)) {
    unregisteredByIgn.set(p.pubgIgn, (unregisteredByIgn.get(p.pubgIgn) ?? 0) + 1);
  }
}

// --- 결과 보고 ---
console.log(`\n내전 ${scrims.length}경기 저장`);
for (const s of scrims) console.log(`  ${s.playedAt}  ${s.participantCount}명`);
if (failedFetches > 0) console.log(`조회 실패 ${failedFetches}건 (건너뜀)`);

// 미등록 참가자 리포트.
// 이건 부가 기능이 아니라 명단을 고치는 주된 수단이다 —
// 여기 뜨는 사람은 대개 외부인이 아니라 명단이 틀린 우리 클랜원이다.
if (unregisteredByIgn.size > 0) {
  console.log(`\n등록되지 않은 참가자 ${unregisteredByIgn.size}명:`);
  for (const [ign, count] of [...unregisteredByIgn].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ign.padEnd(20)} ${count}경기`);
  }
  console.log('\n이 사람들이 누구인지 확인해 명단에 반영하면 과거 기록까지 자동으로 연결된다.');
} else if (scrims.length > 0) {
  console.log('\n모든 참가자가 명단에 등록돼 있다.');
}
