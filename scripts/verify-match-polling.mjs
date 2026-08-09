// 폴링 결과를 실데이터 기대값과 대조한다.
// 사용법: node scripts/verify-match-polling.mjs
//
// 08-02 내전은 사람이 스크린샷으로 확인한 기준점이라 기대값을 못박아 둔다:
//   - 4경기, 각 참가자 64명, member_id 연결 63명, 미등록은 Ez_HxxJxx 하나
//   - 07-31 5경기는 겉모습이 같지만 남의 모임이라 저장되면 안 된다
//
// 나머지 매치는 개수를 못박지 않는다 — 내전이 열릴 때마다 늘어나기 때문이다.
// 대신 구조가 성립하는지(팀 순위가 빠짐없이 있는지 등)를 확인한다.
//
// 데이터 확인에는 service_role 키를 쓴다 — raw_stats 등이 공개 읽기에서 빠져 있다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { MIN_CLAN_RATIO, MIN_PARTICIPANTS } from './lib/matches.mjs';

loadEnvLocal();
const [url, serviceRoleKey, anonKey] = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
);
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const problems = [];
const check = (condition, message) => {
  if (condition) console.log(`  OK  ${message}`);
  else {
    console.log(`  실패 ${message}`);
    problems.push(message);
  }
};

const { data: matches, error } = await supabase
  .from('matches')
  .select(
    'pubg_match_id, played_at, match_type, participant_count, clan_member_count, ' +
      'match_participants(member_id, pubg_ign, team_id, team_rank, kills, win_place)',
  )
  .order('played_at');

if (error) {
  console.error('matches 조회 실패:', error.message);
  process.exitCode = 1;
} else {
  console.log(`저장된 내전: ${matches.length}경기\n`);

  check(matches.length > 0, '내전이 하나 이상 저장돼 있다');

  console.log('판별 기준');
  check(
    matches.every((m) => m.match_type === 'custom'),
    '저장된 매치가 모두 custom 이다',
  );
  check(
    matches.every((m) => m.participant_count >= MIN_PARTICIPANTS),
    `저장된 매치가 모두 참가자 ${MIN_PARTICIPANTS}명 이상이다`,
  );
  check(
    matches.every((m) => m.clan_member_count / m.participant_count >= MIN_CLAN_RATIO),
    `저장된 매치가 모두 클랜원 비율 ${MIN_CLAN_RATIO * 100}% 이상이다`,
  );

  const jul31 = matches.filter((m) => m.played_at.startsWith('2026-07-31'));
  check(
    jul31.length === 0,
    `07-31 남의 모임은 저장되지 않았다 (실제 ${jul31.length}경기)`,
  );

  console.log('\n구조');
  for (const m of matches) {
    const ps = m.match_participants;
    const label = m.played_at.slice(0, 16).replace('T', ' ');

    check(
      ps.length === m.participant_count,
      `${label}: 참가자 행이 ${m.participant_count}개다 (실제 ${ps.length}개)`,
    );

    check(
      ps.filter((p) => p.member_id).length === m.clan_member_count,
      `${label}: member_id 연결 수가 clan_member_count 와 같다`,
    );

    // 4인 스쿼드이므로 팀 수는 참가자 수를 4로 나눈 값이고,
    // 순위는 1부터 그 값까지 빠짐없이 있어야 한다.
    const expectedTeams = Math.ceil(m.participant_count / 4);
    const ranks = [...new Set(ps.map((p) => p.team_rank))].sort((a, b) => a - b);
    const contiguous =
      ranks.length === expectedTeams && ranks[0] === 1 && ranks[ranks.length - 1] === expectedTeams;
    check(contiguous, `${label}: 팀 순위가 1~${expectedTeams} 로 빠짐없이 있다`);

    // 같은 팀 소속은 팀 순위가 같아야 한다
    const rankByTeam = new Map();
    let inconsistent = 0;
    for (const p of ps) {
      const seen = rankByTeam.get(p.team_id);
      if (seen === undefined) rankByTeam.set(p.team_id, p.team_rank);
      else if (seen !== p.team_rank) inconsistent++;
    }
    check(inconsistent === 0, `${label}: 같은 팀 참가자의 순위가 일치한다`);
  }

  // 사람이 스크린샷으로 확인한 기준점
  console.log('\n08-02 내전 (스크린샷으로 확인된 기준점)');
  const aug02 = matches.filter((m) => m.played_at.startsWith('2026-08-02'));
  check(aug02.length === 4, `4경기다 (실제 ${aug02.length}경기)`);

  for (const m of aug02) {
    const ps = m.match_participants;
    const label = m.played_at.slice(11, 16);
    check(ps.length === 64, `${label}: 참가자 64명 (실제 ${ps.length}명)`);
    check(
      ps.filter((p) => p.member_id).length === 63,
      `${label}: member_id 연결 63명 (실제 ${ps.filter((p) => p.member_id).length}명)`,
    );

    const unregistered = ps.filter((p) => !p.member_id).map((p) => p.pubg_ign);
    check(
      unregistered.length === 1 && unregistered[0] === 'Ez_HxxJxx',
      `${label}: 미등록은 Ez_HxxJxx 뿐이다 (실제 ${unregistered.join(', ') || '없음'})`,
    );
  }

  // 공개 키로 무엇이 보이는지
  console.log('\n공개 읽기 권한');
  const publicClient = createClient(url, anonKey);

  const rawAttempt = await publicClient.from('match_participants').select('raw_stats').limit(1);
  check(rawAttempt.error !== null, '공개 키로는 raw_stats 를 못 읽는다');

  const accountAttempt = await publicClient
    .from('match_participants')
    .select('pubg_account_id')
    .limit(1);
  check(accountAttempt.error !== null, '공개 키로는 pubg_account_id 를 못 읽는다');

  const dashboardAttempt = await publicClient
    .from('match_participants')
    .select('pubg_ign, kills, team_rank')
    .limit(1);
  check(
    dashboardAttempt.error === null && (dashboardAttempt.data?.length ?? 0) > 0,
    '공개 키로 pubg_ign, kills, team_rank 는 읽힌다 (대시보드가 필요로 한다)',
  );
}

console.log('');
if (problems.length > 0) {
  console.error(`검증 실패 ${problems.length}건`);
  process.exitCode = 1;
} else {
  console.log('검증 통과');
}
