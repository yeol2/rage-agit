// 이미 저장된 내전 매치를 세션에 묶고, 참가자의 이동거리를 raw_stats 에서 채운다.
// 사용법: node scripts/backfill-sessions.mjs
//
// 폴링은 앞으로 저장할 때 세션을 붙이지만, 그 전에 들어온 매치들은 비어 있다.
// 여러 번 돌려도 결과가 같다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { attachToSession } from '../supabase/functions/_shared/polling.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exitCode = 1;
  throw new Error('중단됨');
}

const { data: clans, error: clanError } = await supabase.from('clans').select('id, name');
if (clanError) fail('clans 조회 실패:', clanError);
if (clans.length !== 1) fail(`clans 가 ${clans.length}개다 — 정확히 1개여야 한다`);
const clanId = clans[0].id;

// --- 세션 묶기 ---
const { data: matches, error: matchError } = await supabase
  .from('matches')
  .select('pubg_match_id, played_at, scrim_session_id')
  .order('played_at');
if (matchError) fail('matches 조회 실패:', matchError);

const unlinked = matches.filter((m) => !m.scrim_session_id);
console.log(`내전 ${matches.length}경기 중 세션 미연결 ${unlinked.length}경기`);

for (const match of unlinked) {
  const sessionId = await attachToSession(supabase, { clanId, playedAt: match.played_at });
  const { error } = await supabase
    .from('matches')
    .update({ scrim_session_id: sessionId })
    .eq('pubg_match_id', match.pubg_match_id);
  if (error) fail(`${match.pubg_match_id} 세션 연결 실패:`, error);
  console.log(`  ${match.played_at.slice(0, 16).replace('T', ' ')} → 세션 연결됨`);
}

// --- 이동거리 채우기 ---
// raw_stats 에 이미 들어 있으므로 다시 가져올 필요가 없다.
const PAGE = 1000;
let filled = 0;
for (;;) {
  const { data: rows, error } = await supabase
    .from('match_participants')
    .select('id, raw_stats')
    .is('walk_distance', null)
    .limit(PAGE);
  if (error) fail('match_participants 조회 실패:', error);
  if (rows.length === 0) break;

  for (const row of rows) {
    const { error: updateError } = await supabase
      .from('match_participants')
      .update({
        walk_distance: row.raw_stats?.walkDistance ?? 0,
        ride_distance: row.raw_stats?.rideDistance ?? 0,
      })
      .eq('id', row.id);
    if (updateError) fail(`참가자 ${row.id} 이동거리 채우기 실패:`, updateError);
    filled++;
  }
}
console.log(`이동거리를 채운 참가자 행: ${filled}개`);

const { data: sessions } = await supabase
  .from('scrim_session_summary')
  .select('scrim_date, title, match_count, participant_count')
  .order('scrim_date');
console.log('\n세션:');
for (const s of sessions ?? []) {
  console.log(`  ${s.scrim_date}  ${s.title}  ${s.match_count}경기  ${s.participant_count}명`);
}
