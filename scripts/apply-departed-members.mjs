// data/departed-members.tsv 에 적힌 탈퇴자를 정리한다.
// 사용법: node scripts/apply-departed-members.mjs          (미리보기 — 아무것도 안 바꾼다)
//         node scripts/apply-departed-members.mjs --apply  (실제 적용)
//
// 나간 사람이 생기면 목록에 한 줄(본계정IGN / 디코ID / 배그계정ID / 날짜 / 비고)을
// 넣고 이 스크립트를 돌린다. 부계정은 적지 않아도 된다 — 셋 중 하나로 사람을 찾아
// 그 사람의 계정 전부를 같이 정리하고, 부계정 이름은 비고에 자동으로 남긴다.
// 형식은 scripts/lib/departed.mjs 참고.
//
// 원칙: **나간 사람은 지우되, 이미 치른 내전은 하나도 바뀌면 안 된다.**
//
// 예전에는 탈퇴자의 참가 행(match_participants / scrim_screenshot_results)을
// 행째로 지웠다. 그러면 그 사람이 있던 팀이 과거 시트에서 3명으로 보이고
// 킬 합계가 모자라 총점 순위가 뒤집혔다(32개 세션 중 4개가 실제로 뒤집혔다).
// 그래서 지금은 참가 행을 **남기고 클랜원 연결(member_id)만 끊는다.**
// 경기에서 낸 킬·등수는 그날 팀의 기록이라 그대로 두고, 사람(members)과
// 그 사람 개인에게 달린 것만 지운다:
//   - members 행 삭제 → 계정(member_pubg_accounts), 개인 세션 등수
//     (session_standings), 등수 스냅샷(ranking_snapshots)은 FK cascade 로 같이 사라진다.
//     다른 팀원의 등수 행은 사람마다 따로라 안 건드려진다.
//   - 리더보드·클랜원 목록·개인 페이지·같은 팀 궁합에서 자연히 빠진다
//     (전부 members 를 거쳐 이름을 붙이기 때문이다).
//
// 미리보기가 기본인 이유: 목록은 수개월치가 쌓여 있어서 나갔다 돌아온 사람이
// 걸린다(2026-09-15 Ez_Diingo — 08-14 탈퇴, 09-14 재가입). 대상을 눈으로 본 뒤
// --apply 로 돌리고, 재가입자는 그 줄 앞에 '> ' 를 붙여 주석으로 돌린다.

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';
import { DEPARTED_PATH, readDeparted, updateDepartedLine } from './lib/departed.mjs';

const APPLY = process.argv.includes('--apply');

loadEnvLocal();

let departed;
try {
  departed = readDeparted();
} catch {
  console.error(`${DEPARTED_PATH} 가 없다 — 아직 탈퇴자를 기록한 적이 없다는 뜻이다.`);
  process.exit(1);
}
const { lines, people } = departed;
console.log(`탈퇴자 목록: ${people.length}명`);

const client = await connectPostgres();

// 본계정IGN / 디코ID / 배그계정ID 중 하나라도 맞는 남아 있는 클랜원을 찾는다.
const targets = [];
for (const person of people) {
  const { rows } = await client.query(
    `select m.id, m.discord_nickname, m.discord_username, m.tier,
            array_agg(a.pubg_ign order by a.pubg_ign) filter (where a.pubg_ign is not null) as igns,
            (array_agg(a.pubg_account_id) filter (where a.pubg_ign = $1))[1] as main_account_id,
            array_remove(array_agg(distinct case
              when a.pubg_ign = $1 then 'IGN'
              when a.pubg_account_id is not null and a.pubg_account_id = $3 then '계정ID'
            end), null) as hit_by_account,
            m.discord_username is not null and m.discord_username = $2 as hit_by_discord
       from members m
       left join member_pubg_accounts a on a.member_id = m.id
      group by m.id
     having bool_or(a.pubg_ign = $1)
         or bool_or(a.pubg_account_id is not null and a.pubg_account_id = $3)
         or (m.discord_username is not null and m.discord_username = $2)`,
    [person.ign, person.discordUsername || null, person.accountId || null],
  );
  for (const row of rows) {
    if (targets.some((t) => t.member.id === row.id)) continue;
    const hitBy = [...row.hit_by_account, ...(row.hit_by_discord ? ['디코ID'] : [])];
    targets.push({ person, member: row, hitBy });
  }
}

if (targets.length === 0) {
  console.log('정리할 클랜원이 없다 — 목록의 사람과 맞는 등록 클랜원이 없다.');
  await client.end();
  process.exit(0);
}

console.log(`\n정리 대상 클랜원 ${targets.length}명:`);
for (const { person, member, hitBy } of targets) {
  const { rows: [counts] } = await client.query(
    `select
       (select count(*)::int from match_participants where member_id = $1) as participants,
       (select count(*)::int from scrim_screenshot_results where member_id = $1) as screenshots,
       (select count(*)::int from session_standings where member_id = $1) as standings,
       (select count(*)::int from ranking_snapshots where member_id = $1) as snapshots,
       (select count(*)::int from scrim_roster_entries where member_id = $1) as roster`,
    [member.id],
  );
  console.log(`  ${member.discord_nickname} (${member.tier}티어, 디코 ${member.discord_username ?? '없음'})`);
  console.log(`    목록 줄: ${person.ign} (${person.date}) — ${hitBy.join('·')} 로 찾음`);
  console.log(`    계정 전체: ${(member.igns ?? []).join(', ') || '없음'}`);
  console.log(
    `    연결 끊음 — 참가 ${counts.participants}행, 스크린샷 ${counts.screenshots}행, 로스터 ${counts.roster}행` +
      ` / 같이 삭제 — 세션 등수 ${counts.standings}행, 스냅샷 ${counts.snapshots}행`,
  );
}

if (!APPLY) {
  console.log('\n미리보기다 — 아무것도 바꾸지 않았다. 대상이 맞으면 --apply 를 붙여 다시 돌릴 것.');
  console.log('나갔다 다시 들어온 사람이 끼어 있으면 목록에서 그 줄 앞에 "> " 를 붙여 뺄 것.');
  await client.end();
  process.exit(0);
}

// 한 사람씩 트랜잭션으로 묶는다 — 연결만 끊기고 삭제가 실패하는 반쪽 상태를 막는다.
for (const { person, member } of targets) {
  await client.query('begin');
  try {
    // match_participants / scrim_screenshot_results / scrim_roster_entries 는 FK 가
    // no action 이라, 먼저 끊지 않으면 members 삭제가 막힌다. 행 자체는 남긴다.
    await client.query(`update match_participants set member_id = null where member_id = $1`, [member.id]);
    await client.query(`update scrim_screenshot_results set member_id = null where member_id = $1`, [member.id]);
    await client.query(
      `update scrim_roster_entries set member_id = null, matched = false where member_id = $1`,
      [member.id],
    );
    await client.query(`delete from members where id = $1`, [member.id]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    console.error(`${member.discord_nickname} 정리 실패 — 되돌렸다:`, error.message);
    process.exitCode = 1;
    continue;
  }

  // 목록 줄에 비어 있던 디코ID·계정ID 를 채우고, 부계정 이름을 비고에 남긴다.
  const altIgns = (member.igns ?? []).filter((ign) => ign !== person.ign);
  updateDepartedLine(DEPARTED_PATH, lines, person, {
    discordUsername: member.discord_username,
    accountId: member.main_account_id,
    altIgns,
  });
  console.log(`정리함: ${member.discord_nickname}${altIgns.length ? ` (부계정 ${altIgns.length}개 비고에 기록)` : ''}`);
}

await client.end();
