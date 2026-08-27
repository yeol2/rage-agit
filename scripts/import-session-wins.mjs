// 스크린샷 시대(2026-02 ~ 05) 내전의 종합우승을 session_wins 에 넣는다.
// 사용법: node scripts/import-session-wins.mjs [--dry-run] [data/session-winners.json]
//
// ⚠️ 0028 이후로 session_wins 는 더 이상 화면이 읽지 않는다. 우승 횟수
// (member_win_counts)와 클랜원 화면의 종합등수는 session_standings 를 본다.
// 이 스크립트를 다시 돌려도 트로피는 늘지 않는다 — 이미 넣은 것을 되짚는
// 검산 근거로만 남겨둔 표다. 새 기록은 03 내전 시트의 "우승 확정" 버튼이
// (app/api/scrim-roster/round-sheet/confirm-win) 1~16위째로 넣는다.
//
// 우승팀을 데이터에서 되짚을 수 없어서 사람이 시트를 읽어 넣는다 —
// 탈퇴자 정리가 참가 기록을 행째로 지운 탓에 팀 킬 합계가 미달되고,
// 총점 순위가 뒤집힌다(0027 마이그레이션 주석 참고). 실제로 17개 세션 중
// 3개(02-20, 04-05, 05-31)는 남은 데이터로 계산하면 우승팀이 달라진다.
//
// 그래서 넣기 전에 두 가지를 대조한다. 둘 다 틀린 팀번호를 적었을 때 걸린다.
//   1. 순위점수 — team_rank 는 팀 단위 값이라 탈퇴자와 무관하게 온전하다.
//      시트의 PLACE 칸과 DB 에서 계산한 값이 같아야 한다.
//   2. 로스터 — 시트에 적힌 4명 중 DB 에 남아 있는 사람은 모두 그 팀에 있어야 한다.

import { readFileSync } from 'node:fs';
import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonPath = args.find((a) => !a.startsWith('--')) ?? 'data/session-winners.json';

const { sessions, matchEraSessions } = JSON.parse(readFileSync(jsonPath, 'utf8'));
const client = await connectPostgres();

const problems = [];
const planned = [];

// 시트 이름은 Ez_ 접두사가 없고 대소문자·기호가 흔들린다.
const norm = (v) => v.toLowerCase().replace(/^ezb?_/, '').replace(/[^a-z0-9]/g, '');
// 시트는 칸이 좁아 이름을 줄여 적기도 하고(GarlicDPS → Garlic), 반대로 늘어난
// 표기도 있다(MANDU → MANDUUUUU). 어느 쪽이든 접두사면 같은 사람으로 본다.
const sameName = (a, b) => {
  const [x, y] = [norm(a), norm(b)];
  return x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x));
};

for (const s of sessions) {
  const label = `${s.scrimDate} #${String(s.teamNo).padStart(2, '0')}`;

  // 1. 순위점수 대조
  const { rows: pointRows } = await client.query(
    `select sum(placement_points(team_rank)) as place_points
     from (
       select round_no, max(team_rank) as team_rank
       from scrim_screenshot_results
       where scrim_date = $1 and team_no = $2
       group by round_no
     ) t`,
    [s.scrimDate, s.teamNo],
  );
  const dbPlace = Number(pointRows[0]?.place_points ?? 0);
  if (dbPlace !== s.place) {
    problems.push(`${label}: 순위점수가 어긋난다 — 시트 ${s.place}, DB ${dbPlace}`);
    continue;
  }

  // 2. 로스터 대조 + 우승자 확정
  //
  // 한 사람이 이름을 여러 개 쓴다. 부계정·개명은 member_pubg_accounts 에
  // 이미 정리돼 있으므로(reference-participant-reconciliation 절차) 그걸 끌어와
  // 시트 이름과 맞춘다 — 예: 시트의 Xavi- 가 스크린샷에는 KangJa 로 찍혀 있다.
  const { rows: memberRows } = await client.query(
    `select distinct r.member_id, m.discord_nickname, r.pubg_ign,
            array(select a.pubg_ign from member_pubg_accounts a where a.member_id = r.member_id) as known_igns
     from scrim_screenshot_results r
     join members m on m.id = r.member_id
     where r.scrim_date = $1 and r.team_no = $2`,
    [s.scrimDate, s.teamNo],
  );

  const namesOf = (row) => [row.pubg_ign, ...(row.known_igns ?? [])];

  const missing = s.roster.filter(
    (name) => !memberRows.some((r) => namesOf(r).some((ign) => sameName(ign, name))),
  );

  // 시트에 있는데 DB 에 없는 사람은 탈퇴자다 — 정상이다. 반대로 DB 에 있는데
  // 시트에 없으면 팀번호를 잘못 읽었다는 뜻이라, 그때만 막는다.
  const extra = memberRows.filter(
    (r) => !s.roster.some((name) => namesOf(r).some((ign) => sameName(ign, name))),
  );
  if (extra.length > 0) {
    problems.push(
      `${label}: 시트에 없는 사람이 이 팀에 있다 — ${extra.map((e) => e.pubg_ign).join(', ')}`,
    );
    continue;
  }

  planned.push({ ...s, members: memberRows, departed: missing, source: 'screenshot' });
}

// 매치 시대(2026-06-07~). 세션 단위 팀번호가 없으므로 시트에 적힌 이름으로
// 사람을 찾는다. 그 세션에 실제로 뛴 사람만 후보로 두면(그냥 members 전체에서
// 찾는 것과 달리) 동명이인이나 접두사 충돌이 훨씬 덜 생긴다.
for (const s of matchEraSessions ?? []) {
  const label = s.scrimDate;
  const { rows: played } = await client.query(
    `select distinct p.member_id, m.discord_nickname,
            array(select a.pubg_ign from member_pubg_accounts a where a.member_id = p.member_id) as known_igns
     from match_participants p
     join matches mt using (pubg_match_id)
     join scrim_sessions ss on ss.id = mt.scrim_session_id
     join members m on m.id = p.member_id
     where ss.scrim_date = $1 and mt.excluded_reason is null and p.member_id is not null`,
    [s.scrimDate],
  );

  const members = [];
  const departed = [];
  for (const name of s.roster) {
    const hits = played.filter((r) =>
      [...(r.known_igns ?? []), r.discord_nickname].some((ign) => sameName(ign, name)),
    );
    if (hits.length === 0) {
      departed.push(name); // 탈퇴자거나 미등록 게스트다 — 우승 카운트 대상이 아니다.
    } else if (hits.length > 1) {
      problems.push(
        `${label}: "${name}" 이 여러 사람과 맞는다 — ${hits.map((h) => h.discord_nickname).join(', ')}`,
      );
    } else {
      members.push(hits[0]);
    }
  }

  // 4명 중 둘 이상을 못 찾으면 우승팀을 잘못 적었을 가능성이 크다.
  if (members.length < 2) {
    problems.push(`${label}: 우승자 ${s.roster.length}명 중 ${members.length}명만 찾았다`);
    continue;
  }
  planned.push({ ...s, teamNo: null, members, departed, source: 'match' });
}

const totalSessions = sessions.length + (matchEraSessions?.length ?? 0);
console.log(`세션 ${totalSessions}개 중 ${planned.length}개 검증 통과\n`);
for (const p of planned) {
  const names = p.members.map((m) => m.discord_nickname).join(', ');
  const dep = p.departed.length > 0 ? `  (제외: ${p.departed.join(', ')})` : '';
  const team = p.teamNo == null ? '    ' : `#${String(p.teamNo).padStart(2, '0')} `;
  console.log(`${p.scrimDate} ${team} ${p.members.length}명  ${names}${dep}`);
}

if (problems.length > 0) {
  console.error(`\n검증 실패 ${problems.length}건 — 아무것도 넣지 않는다:`);
  for (const p of problems) console.error(`  ${p}`);
  await client.end();
  process.exit(1);
}

if (dryRun) {
  console.log('\n--dry-run 이라 여기서 멈춘다.');
  await client.end();
  process.exit(0);
}

let inserted = 0;
for (const p of planned) {
  for (const m of p.members) {
    const { rowCount } = await client.query(
      `insert into session_wins (scrim_date, session_number, team_no, member_id, source, note)
       values ($1, 1, $2, $3, $4, $5)
       on conflict (scrim_date, session_number, member_id) do nothing`,
      [p.scrimDate, p.teamNo, m.member_id, p.source, p.sheetFile ?? '매치 기록 합산'],
    );
    inserted += rowCount;
  }
}
console.log(`\n${inserted}행 넣었다.`);
await client.end();
