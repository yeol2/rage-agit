// dak.gg 적재 결과가 말이 되는지 확인한다.
// 사용법: node scripts/verify-dakgg-import.mjs
//
// 적재가 에러 없이 끝났다는 것과 맞게 들어갔다는 것은 다르다.
// 중복 가드가 한 번 새면 그날 경기가 6개가 되고, 조용히 그대로 남는다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const problems = [];
const check = (ok, message) => {
  console.log(ok ? `  OK  ${message}` : `  실패 ${message}`);
  if (!ok) problems.push(message);
};

const { data: matches } = await supabase
  .from('matches')
  .select('pubg_match_id, played_at, map_name, source, participant_count, clan_member_count')
  .order('played_at');

console.log('\n출처별 매치 수');
const bySource = {};
for (const m of matches) bySource[m.source] = (bySource[m.source] ?? 0) + 1;
for (const [source, count] of Object.entries(bySource)) console.log(`  ${source}: ${count}경기`);

console.log('\n세션');
const { data: sessions } = await supabase
  .from('scrim_session_summary')
  .select('scrim_date, title, match_count, participant_count')
  .order('scrim_date');
for (const s of sessions ?? []) {
  console.log(`  ${s.scrim_date}  ${s.match_count}경기  ${s.participant_count}명  ${s.title}`);
}

console.log('\n확인');

// 내전은 하루 4경기다. 5경기 이상이면 중복 가드가 샌 것이다.
for (const s of sessions ?? []) {
  check(s.match_count <= 4, `${s.scrim_date} 의 경기가 4개 이하다 (${s.match_count}개)`);
}

// 참가자 수가 적으면 뷰의 count(distinct) 가 NULL 을 빼먹은 것이다.
for (const s of sessions ?? []) {
  check(
    s.participant_count >= 40,
    `${s.scrim_date} 의 참가자가 40명 이상이다 (${s.participant_count}명)`,
  );
}

// 같은 경기가 두 지문으로 들어갔는지 — 같은 날 같은 참가자·킬 조합.
const idByKey = new Map();
const duplicates = [];
for (const m of matches) {
  const { data: rows } = await supabase
    .from('match_participants')
    .select('pubg_ign, kills')
    .eq('pubg_match_id', m.pubg_match_id);
  const key =
    m.played_at.slice(0, 10) +
    '|' +
    rows
      .map((r) => `${r.pubg_ign}:${r.kills}`)
      .sort()
      .join(',');
  if (idByKey.has(key)) {
    duplicates.push(`${idByKey.get(key)} 와 ${m.pubg_match_id}`);
  }
  idByKey.set(key, m.pubg_match_id);
}
check(duplicates.length === 0, '같은 내용의 매치가 중복으로 들어가지 않았다');
for (const d of duplicates) console.log(`    중복: ${d}`);

// dak.gg 행은 없는 지표가 NULL 이어야 한다. 0 이 섞이면 평균이 틀어진다.
const dakggIds = matches.filter((m) => m.source === 'dakgg').map((m) => m.pubg_match_id);
if (dakggIds.length > 0) {
  const { count: filledHeals } = await supabase
    .from('match_participants')
    .select('id', { count: 'exact', head: true })
    .in('pubg_match_id', dakggIds)
    .not('heals', 'is', null);
  check(filledHeals === 0, 'dak.gg 참가자의 heals 가 전부 NULL 이다');

  const { count: noDistance } = await supabase
    .from('match_participants')
    .select('id', { count: 'exact', head: true })
    .in('pubg_match_id', dakggIds)
    .is('total_distance', null);
  check(noDistance === 0, 'dak.gg 참가자의 이동거리가 전부 채워져 있다');
}

// 못 알아본 닉네임 — 개명한 클랜원이 섞여 있을 수 있다.
const { data: unlinked } = await supabase
  .from('match_participants')
  .select('pubg_ign')
  .is('member_id', null);
const igns = [...new Set((unlinked ?? []).map((r) => r.pubg_ign))];
console.log(`\n클랜원으로 연결 안 된 닉네임 ${igns.length}개`);
if (igns.length > 0) console.log(`  ${igns.slice(0, 30).join(', ')}${igns.length > 30 ? ' …' : ''}`);
console.log('  탈퇴자·게스트면 정상이다. 개명한 클랜원이 보이면');
console.log('  scripts/link-alt-account.mjs → scripts/relink-participants.mjs 로 이어붙인다.');

console.log('');
if (problems.length > 0) {
  console.log(`문제 ${problems.length}건`);
  process.exit(1);
}
console.log('이상 없다.');
