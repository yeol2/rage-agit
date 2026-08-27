// 최근 10회 내전의 종합 시트에서 읽은 1~16위를 session_standings 에 넣는다.
// 사용법: node scripts/import-session-standings.mjs [--dry-run] [data/session-standings.json]
//
// 왜 계산이 아니라 시트를 읽어 넣나: 0027/0028 마이그레이션 주석 참고.
// 탈퇴자 정리가 참가 기록을 행째로 지워서 팀 킬 합계가 미달되고, 총점 =
// 순위점수 + 킬이라 순위가 뒤집힌다. 시트가 정답이다.
//
// 넣기 전에 세 가지를 대조한다. 눈으로 옮긴 숫자는 틀리기 때문이다.
//   1. 시트 자체 검산 — place + kill = total, 등수 정렬(총점 내림차순,
//      동점이면 순위점수 내림차순), 팀번호·이름 중복 없음.
//   2. 순위점수 — team_rank 는 팀 단위 값이라 탈퇴자와 무관하게 온전하다.
//      매칭된 팀원들의 라운드별 team_rank 로 구한 값이 시트의 PLACE 칸과
//      같아야 한다. 팀을 통째로 잘못 짚으면 여기서 걸린다.
//   3. 사람 배정 — 한 사람이 두 팀에 들어가면 안 되고, 그 세션에 실제로 뛴
//      클랜원이 어느 줄에도 안 붙으면 그 줄의 이름을 잘못 읽었다는 뜻이다.

import { readFileSync } from 'node:fs';
import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';
import { placementPoints } from '../lib/placementPoints.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonPath = args.find((a) => !a.startsWith('--')) ?? 'data/session-standings.json';

const { sessions } = JSON.parse(readFileSync(jsonPath, 'utf8'));
const client = await connectPostgres();

const problems = [];
const planned = [];

// 시트 이름은 Ez_ 접두사가 없고 대소문자·기호가 흔들린다.
const norm = (v) => v.toLowerCase().replace(/^ezb?_/, '').replace(/[^a-z0-9]/g, '');

// 이름 맞추기는 두 단계다. import-session-wins.mjs 는 처음부터 접두사로 맞췄는데,
// 그 규칙만 쓰면 실제로 다른 사람끼리 붙는다 —
//   Ez_Zzang9 ⊂ Ez_Zzang9FanT, Ez_JuHyuN ⊂ Ez_Juhyunping, Ez_Rin ⊂ Ez_rindA.
// 그래서 정확히 같은 이름을 먼저 찾고, 없을 때만 접두사로 넓힌다 (시트는 칸이 좁아
// 줄여 적거나 늘여 적는다: GarlicDPS → Garlic, MANDU → MANDUUUUU).
// 길이 제한은 두지 않는다 — Ez_WY, Ez_BX, Ez_GE 처럼 두 글자짜리가 실제로 있다.
const exactName = (a, b) => norm(a) === norm(b);
const prefixName = (a, b) => {
  const [x, y] = [norm(a), norm(b)];
  return x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x));
};

// 후보 중에서 이 시트 이름에 해당하는 사람을 고른다.
// { hit } | { none: true } | { ambiguous: [...] }
//
// 두 번에 나눠 돌린다. 접두사 매칭을 이름마다 그 자리에서 해버리면, 그날 안
// 뛴 사람의 이름이 남의 부계정을 낚아챈다 — 실제로 시트의 "zzang_9"(그날 안 뛴
// Ez_Zzang9)가 Ez_Zzang9FanT(Ez_JJOGI 의 부계정)를 물어서, 다른 줄에 이름
// 그대로 적혀 있던 JJOGI 를 엉뚱한 팀으로 끌고 갔다.
// 그래서 세션 전체에 정확 매칭을 먼저 다 돌리고(pass 1), 접두사는 그러고도
// 남은 사람에게만 넓힌다(pass 2).
function findExact(candidates, name) {
  const hits = candidates.filter((c) => c.igns.some((ign) => exactName(ign, name)));
  if (hits.length === 1) return { hit: hits[0] };
  if (hits.length > 1) return { ambiguous: hits };
  return { none: true };
}

function findPrefix(candidates, name) {
  const hits = candidates.filter((c) => c.igns.some((ign) => prefixName(ign, name)));
  if (hits.length === 1) return { hit: hits[0] };
  if (hits.length > 1) return { ambiguous: hits };
  return { none: true };
}

/* ---------- 1. 시트 자체 검산 ---------- */
for (const s of sessions) {
  s.teams.forEach((t, i) => {
    const at = `${s.scrimDate} ${i + 1}위`;
    if (t.place + t.kill !== t.total) {
      problems.push(`${at}: place+kill≠total (${t.place}+${t.kill}≠${t.total})`);
    }
    if (i > 0) {
      const prev = s.teams[i - 1];
      if (t.total > prev.total) problems.push(`${at}: 정렬 역전 (${prev.total} < ${t.total})`);
      else if (t.total === prev.total && t.place > prev.place) {
        problems.push(`${at}: 동점인데 순위점수가 역전 (${prev.place} < ${t.place})`);
      }
    }
  });
  const nos = new Set(s.teams.map((t) => t.teamNo));
  if (nos.size !== s.teams.length) problems.push(`${s.scrimDate}: 팀번호가 중복이다`);
  const names = s.teams.flatMap((t) => t.players);
  const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  if (dup.length > 0) problems.push(`${s.scrimDate}: 이름이 중복이다 — ${dup.join(', ')}`);
}

/* ---------- 2·3. DB 대조 ---------- */
for (const s of sessions) {
  // 그 세션에 실제로 뛴 클랜원만 후보로 둔다 — members 전체에서 찾는 것보다
  // 동명이인·접두사 충돌이 훨씬 덜 생긴다.
  const { rows: played } = await client.query(
    `select p.member_id, m.discord_nickname, p.pubg_ign, mt.pubg_match_id, mt.played_at, p.team_rank,
            array(select a.pubg_ign from member_pubg_accounts a where a.member_id = p.member_id) as known_igns
     from match_participants p
     join matches mt using (pubg_match_id)
     join scrim_sessions ss on ss.id = mt.scrim_session_id
     join members m on m.id = p.member_id
     where ss.scrim_date = $1 and mt.excluded_reason is null and p.member_id is not null`,
    [s.scrimDate],
  );
  if (played.length === 0) {
    problems.push(`${s.scrimDate}: 이 날짜의 매치 참가 기록이 없다`);
    continue;
  }

  // 사람 하나로 접어둔다 (한 사람이 매치 수만큼 행을 갖는다).
  const byMember = new Map();
  for (const r of played) {
    const cur = byMember.get(r.member_id) ?? {
      memberId: r.member_id,
      nickname: r.discord_nickname,
      // 그날 실제로 쓴 IGN(p.pubg_ign)도 넣는다 — 시트는 그날의 인게임 이름을 적기
      // 때문이다. member_pubg_accounts 에 아직 안 올라온 계정이 실제로 있다
      // (Ez_zzang_9 = Ez_dmfkckck, Ez_Thugclub = Ez_Owen). 그 계정들도
      // match_participants 에서는 이미 올바른 사람으로 연결돼 있다.
      igns: [...(r.known_igns ?? []), r.discord_nickname],
      ranks: new Map(), // pubg_match_id -> team_rank
    };
    if (!cur.igns.includes(r.pubg_ign)) cur.igns.push(r.pubg_ign);
    cur.ranks.set(r.pubg_match_id, r.team_rank);
    byMember.set(r.member_id, cur);
  }
  const candidates = [...byMember.values()];
  const matchIds = [...new Set(played.map((r) => r.pubg_match_id))];

  const assigned = new Map(); // member_id -> standing
  const rows = [];
  let departedCount = 0;
  const unmatchedNames = [];
  const resolvedNames = new Set();
  let sessionBad = false;

  // 팀별로 확정된 사람을 담는다 (인덱스 = 등수-1).
  const membersByStanding = s.teams.map(() => []);

  for (const pass of ['exact', 'prefix']) {
    s.teams.forEach((t, i) => {
      const standing = i + 1;
      const at = `${s.scrimDate} ${standing}위(#${t.teamNo})`;

      for (const name of t.players) {
        if (resolvedNames.has(`${standing}:${name}`)) continue;
        // pass 2 는 아직 아무 줄에도 안 붙은 사람만 후보로 본다.
        const pool = pass === 'exact' ? candidates : candidates.filter((c) => !assigned.has(c.memberId));
        const found = pass === 'exact' ? findExact(pool, name) : findPrefix(pool, name);

        if (found.none) {
          if (pass === 'prefix') {
            // 시트에 있는데 DB 에 없는 사람 = 탈퇴자/미등록. 대개 정상이지만,
            // 이름을 잘못 읽었을 때도 여기로 떨어지므로 아래에서 같이 보고한다.
            departedCount += 1;
            unmatchedNames.push(name);
          }
          continue;
        }
        if (found.ambiguous) {
          problems.push(
            `${at}: "${name}" 이 여러 사람과 맞는다 — ${found.ambiguous.map((h) => h.nickname).join(', ')}`,
          );
          sessionBad = true;
          resolvedNames.add(`${standing}:${name}`);
          continue;
        }
        const hit = found.hit;
        if (assigned.has(hit.memberId)) {
          problems.push(
            `${at}: ${hit.nickname} 이 ${assigned.get(hit.memberId)}위에도 들어가 있다 (이름을 잘못 읽었을 가능성)`,
          );
          sessionBad = true;
          resolvedNames.add(`${standing}:${name}`);
          continue;
        }
        assigned.set(hit.memberId, standing);
        membersByStanding[i].push(hit);
        resolvedNames.add(`${standing}:${name}`);
      }
    });
  }

  s.teams.forEach((t, i) => {
    const standing = i + 1;
    const at = `${s.scrimDate} ${standing}위(#${t.teamNo})`;
    const members = membersByStanding[i];

    // 순위점수 대조 — 팀원끼리는 같은 team_rank 를 공유하는 게 정상이지만,
    // 어긋나면 방어적으로 최솟값(더 높은 순위)을 쓴다(lib/roundSheet.ts 와 같은 규칙).
    if (members.length > 0) {
      let dbPlace = 0;
      for (const matchId of matchIds) {
        const ranks = members.map((m) => m.ranks.get(matchId)).filter((r) => r !== undefined);
        if (ranks.length > 0) dbPlace += placementPoints(Math.min(...ranks));
      }
      if (dbPlace !== t.place) {
        problems.push(`${at}: 순위점수가 어긋난다 — 시트 ${t.place}, DB ${dbPlace}`);
        sessionBad = true;
      }
    }

    for (const m of members) {
      rows.push({
        scrim_date: s.scrimDate,
        session_number: 1,
        standing,
        team_no: t.teamNo,
        place_points: t.place,
        kills: t.kill,
        total_score: t.total,
        member_id: m.memberId,
        source: 'sheet',
        note: `종합 시트 판독 (${s.sheetFile})`,
      });
    }
  });

  // 뛴 기록은 있는데 어느 줄에도 안 붙은 사람 — 그 줄의 이름을 잘못 읽었다는 뜻이다.
  // DB 에서 못 찾은 시트 이름을 같이 보여준다: 대개 이 두 목록이 서로 짝이라
  // 어느 칸을 잘못 읽었는지 바로 보인다 (예: 시트 "Gimll" ↔ DB Ez_Gimli).
  const unplaced = candidates.filter((c) => !assigned.has(c.memberId));
  if (unplaced.length > 0) {
    problems.push(
      `${s.scrimDate}: 뛴 기록이 있는데 시트 어느 줄에도 없다 — ${unplaced.map((u) => u.nickname).join(', ')}` +
        (unmatchedNames.length > 0
          ? ` / DB 에서 못 찾은 시트 이름: ${unmatchedNames.join(', ')}`
          : ''),
    );
    sessionBad = true;
  }

  if (!sessionBad) planned.push({ scrimDate: s.scrimDate, rows, departedCount, teams: s.teams.length });
}

/* ---------- 보고 ---------- */
console.log('');
console.log('날짜         팀수  적재행  탈퇴/미등록  매치');
for (const p of planned) {
  console.log(
    `${p.scrimDate}  ${String(p.teams).padStart(4)}  ${String(p.rows.length).padStart(6)}  ${String(p.departedCount).padStart(11)}`,
  );
}

if (problems.length > 0) {
  console.log('');
  console.error(`문제 ${problems.length}건 — 아무것도 넣지 않는다`);
  for (const p of problems) console.error(`  ${p}`);
  await client.end();
  process.exit(1);
}

const total = planned.reduce((n, p) => n + p.rows.length, 0);
console.log('');
console.log(`대조 통과 — ${planned.length}개 세션 / ${total}행`);

if (dryRun) {
  console.log('--dry-run 이므로 넣지 않는다.');
  await client.end();
  process.exit(0);
}

// 시트가 정답이므로 그 날짜의 기존 기록(확정 버튼이 넣은 source='match' 포함)을
// 갈아엎는다. 한 트랜잭션으로 — 중간에 실패하면 아무것도 남지 않는다.
try {
  await client.query('begin');
  for (const p of planned) {
    await client.query('delete from session_standings where scrim_date = $1 and session_number = 1', [
      p.scrimDate,
    ]);
    for (const r of p.rows) {
      await client.query(
        `insert into session_standings
           (scrim_date, session_number, standing, team_no, place_points, kills, total_score,
            member_id, source, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          r.scrim_date, r.session_number, r.standing, r.team_no, r.place_points, r.kills,
          r.total_score, r.member_id, r.source, r.note,
        ],
      );
    }
  }
  await client.query('commit');
  console.log(`적재 완료 — ${total}행`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`적재 실패: ${error.message}`);
  await client.end();
  process.exit(1);
}

await client.end();
