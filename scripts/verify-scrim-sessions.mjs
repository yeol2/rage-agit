// 내전 세션 묶기 결과를 실데이터 기대값과 대조한다.
// 사용법: node scripts/verify-scrim-sessions.mjs
//
// 기대값은 관리자가 게임 결과 스크린샷과 대조해 확인한 값에서 나온다.
// 데이터 확인에는 service_role 키를 쓰고, 공개 키로 무엇이 보이는지는 따로 확인한다.

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { scrimSessionTitle, toKstDate } from '../supabase/functions/_shared/sessions.mjs';

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

const { data: sessions, error } = await supabase
  .from('scrim_session_summary')
  .select('*')
  .order('scrim_date');
if (error) {
  console.error('scrim_session_summary 조회 실패:', error.message);
  process.exitCode = 1;
} else {
  console.log(`세션 ${sessions.length}개\n`);

  console.log('세션 요약');
  // 07-26 이 2경기뿐인 것은 폴링을 만들기 전에 나머지가 API 목록에서 사라졌기 때문이다.
  const expected = {
    '2026-07-26': { matches: 2, participants: 68 },
    '2026-08-02': { matches: 4, participants: 64 },
    '2026-08-09': { matches: 4, participants: 64 },
  };
  for (const [date, want] of Object.entries(expected)) {
    const s = sessions.find((x) => x.scrim_date === date);
    check(s !== undefined, `${date} 세션이 있다`);
    if (!s) continue;
    check(s.match_count === want.matches, `${date}: ${want.matches}경기다 (실제 ${s.match_count})`);
    check(
      s.participant_count === want.participants,
      `${date}: 참가 ${want.participants}명이다 (실제 ${s.participant_count})`,
    );
    check(
      s.title === scrimSessionTitle(date),
      `${date}: 제목이 요일까지 맞다 (실제 ${s.title})`,
    );
  }

  console.log('\n매치 연결');
  const { data: matches } = await supabase
    .from('matches')
    .select('pubg_match_id, played_at, scrim_session_id');
  check(
    matches.every((m) => m.scrim_session_id),
    `내전 매치 ${matches.length}개 전부에 세션이 붙어 있다`,
  );

  // 붙은 세션의 날짜가 그 매치의 한국시간 날짜와 같은가
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const misdated = matches.filter(
    (m) => sessionById.get(m.scrim_session_id)?.scrim_date !== toKstDate(m.played_at),
  );
  check(misdated.length === 0, '매치가 자기 한국시간 날짜의 세션에 붙어 있다');

  console.log('\n이동거리');
  const { data: dist } = await supabase
    .from('match_participants')
    .select('id')
    .is('walk_distance', null);
  check(dist.length === 0, `이동거리가 비어 있는 참가자 행이 없다 (실제 ${dist.length}개)`);

  console.log('\n공개 읽기');
  const publicClient = createClient(url, anonKey);

  const summaryAttempt = await publicClient
    .from('scrim_session_summary')
    .select('scrim_date, title, match_count, participant_count')
    .limit(1);
  check(
    summaryAttempt.error === null && (summaryAttempt.data?.length ?? 0) > 0,
    '공개 키로 세션 요약을 읽을 수 있다 (대시보드가 필요로 한다)',
  );

  const distAttempt = await publicClient
    .from('match_participants')
    .select('walk_distance, ride_distance')
    .limit(1);
  check(distAttempt.error === null, '공개 키로 이동거리를 읽을 수 있다');

  const rawAttempt = await publicClient.from('match_participants').select('raw_stats').limit(1);
  check(rawAttempt.error !== null, '공개 키로는 raw_stats 를 여전히 못 읽는다');
}

console.log('');
if (problems.length > 0) {
  console.error(`검증 실패 ${problems.length}건`);
  process.exitCode = 1;
} else {
  console.log('검증 통과');
}
