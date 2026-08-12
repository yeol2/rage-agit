// 디스코드 결과 스크린샷에서 읽은 내전을 검사하고 DB 행으로 옮긴다.
//
// 스크린샷은 두 종류가 짝을 이룬다:
//   - 종합 시트: 그날 전체. 팀마다 라운드별 [순위, 점수, 킬, 합계].
//   - 인게임 매치 결과: 한 매치. 팀 등수 + 선수별 킬.
//
// 둘 다 읽어서 대조하는 게 이 모듈의 핵심이다. 사람이 눈으로 옮긴 숫자라
// 틀릴 수 있는데, 시트의 팀 킬 합계와 인게임 선수 킬의 합이 어긋나면
// 그 자리에서 드러난다. 대조 없이 넣으면 틀린 값이 조용히 랭킹에 남는다.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(message);
}

export function validateFile(file) {
  if (!file || typeof file !== 'object') fail('JSON 이 객체가 아니다');
  if (typeof file.scrimDate !== 'string' || !DATE_PATTERN.test(file.scrimDate)) {
    fail(`scrimDate 는 YYYY-MM-DD 여야 한다: ${JSON.stringify(file.scrimDate)}`);
  }
  if (!Array.isArray(file.sheet) || file.sheet.length === 0) {
    fail(`${file.scrimDate}: sheet 가 비어 있다`);
  }
  if (!Array.isArray(file.matches) || file.matches.length === 0) {
    fail(`${file.scrimDate}: matches 가 비어 있다`);
  }

  for (const team of file.sheet) {
    if (!Number.isInteger(team.teamNo)) {
      fail(`${file.scrimDate}: sheet 에 teamNo 가 없는 팀이 있다`);
    }
    if (!Array.isArray(team.rounds) || team.rounds.length === 0) {
      fail(`${file.scrimDate}: sheet 의 ${team.teamNo}팀에 rounds 가 없다`);
    }
    for (const r of team.rounds) {
      if (!Number.isInteger(r.round) || r.round < 1) {
        fail(`${file.scrimDate}: sheet ${team.teamNo}팀의 round 가 이상하다`);
      }
      if (!Number.isInteger(r.place) || r.place < 1 || r.place > 16) {
        fail(`${file.scrimDate} ${r.round}경기 ${team.teamNo}팀: place 가 1~16 이 아니다`);
      }
      if (!Number.isInteger(r.kills) || r.kills < 0) {
        fail(`${file.scrimDate} ${r.round}경기 ${team.teamNo}팀: kills 가 이상하다`);
      }
    }
  }

  const seenRounds = new Set();
  for (const match of file.matches) {
    if (!Number.isInteger(match.round) || match.round < 1) {
      fail(`${file.scrimDate}: round 가 숫자가 아닌 매치가 있다`);
    }
    if (seenRounds.has(match.round)) {
      fail(`${file.scrimDate}: ${match.round}경기가 두 번 있다`);
    }
    seenRounds.add(match.round);
    if (!Array.isArray(match.teams)) {
      fail(`${file.scrimDate} ${match.round}경기: teams 가 없다`);
    }

    const places = new Set();
    const teamNos = new Set();
    const igns = new Set();
    for (const team of match.teams) {
      if (!Number.isInteger(team.teamNo)) {
        fail(`${file.scrimDate} ${match.round}경기: teamNo 가 없는 팀이 있다`);
      }
      if (teamNos.has(team.teamNo)) {
        fail(`${file.scrimDate} ${match.round}경기: 팀 번호 ${team.teamNo} 가 두 번 나온다`);
      }
      teamNos.add(team.teamNo);

      if (!Number.isInteger(team.place) || team.place < 1 || team.place > 16) {
        fail(`${file.scrimDate} ${match.round}경기 ${team.teamNo}팀: place 가 1~16 이 아니다`);
      }
      if (places.has(team.place)) {
        fail(`${file.scrimDate} ${match.round}경기: 등수 ${team.place} 가 두 번 나온다`);
      }
      places.add(team.place);

      if (!Array.isArray(team.players) || team.players.length === 0) {
        fail(`${file.scrimDate} ${match.round}경기 ${team.teamNo}팀: players 가 비어 있다`);
      }
      for (const p of team.players) {
        if (typeof p.ign !== 'string' || p.ign.trim() === '') {
          fail(`${file.scrimDate} ${match.round}경기 ${team.teamNo}팀: ign 이 비어 있다`);
        }
        if (igns.has(p.ign)) {
          fail(`${file.scrimDate} ${match.round}경기: 닉네임 ${p.ign} 가 두 번 나온다`);
        }
        igns.add(p.ign);
        if (!Number.isInteger(p.kills) || p.kills < 0) {
          fail(`${file.scrimDate} ${match.round}경기: '${p.ign}' 의 kills 가 이상하다`);
        }
      }
    }
  }
}

// 시트와 인게임이 서로 맞는지 본다. 못 맞는 것마다 한 줄씩 돌려준다.
// 던지지 않고 모아서 돌려주는 이유: 한 번에 다 보여줘야 고치기 쉽다.
export function crossCheck(file) {
  const problems = [];

  // 시트를 (라운드, 팀) 으로 뒤집어 찾기 쉽게 만든다.
  const sheetBy = new Map();
  const sheetRounds = new Set();
  for (const team of file.sheet) {
    for (const r of team.rounds) {
      sheetBy.set(`${r.round}:${team.teamNo}`, r);
      sheetRounds.add(r.round);
    }
  }

  for (const match of file.matches) {
    if (!sheetRounds.has(match.round)) {
      problems.push(`${match.round}경기: 시트에 그 라운드가 없다`);
      continue;
    }
    for (const team of match.teams) {
      const key = `${match.round}:${team.teamNo}`;
      const fromSheet = sheetBy.get(key);
      if (!fromSheet) {
        problems.push(`${match.round}경기 ${team.teamNo}팀: 시트에 없다`);
        continue;
      }
      if (fromSheet.place !== team.place) {
        problems.push(
          `${match.round}경기 ${team.teamNo}팀: 등수가 시트 ${fromSheet.place} vs 인게임 ${team.place}`,
        );
      }
      const sum = team.players.reduce((total, p) => total + p.kills, 0);
      if (fromSheet.kills !== sum) {
        problems.push(
          `${match.round}경기 ${team.teamNo}팀: 킬 합계가 시트 ${fromSheet.kills} vs 인게임 ${sum}`,
        );
      }
      sheetBy.delete(key);
    }
  }

  // 인게임에서 아예 빠진 팀. 스크린샷 아래쪽이 잘려 팀을 통째로 놓치는 일이 있다.
  for (const [key] of sheetBy) {
    const [round, teamNo] = key.split(':');
    problems.push(`${round}경기 ${teamNo}팀: 인게임 이미지에 없다`);
  }

  return problems;
}

// resolve 는 닉네임으로 member_id 를 찾는 함수다 — DB 조회를 밖으로 빼서
// 이 함수가 순수하게 남는다 (dakgg.mjs 의 buildMatch 와 같은 방식).
export function buildRows(file, resolve) {
  const rows = [];
  for (const match of file.matches) {
    for (const team of match.teams) {
      for (const player of team.players) {
        rows.push({
          scrim_date: file.scrimDate,
          round_no: match.round,
          team_no: team.teamNo,
          team_rank: team.place,
          pubg_ign: player.ign,
          member_id: resolve(player.ign) ?? null,
          kills: player.kills,
          source_file: match.sourceFile ?? null,
        });
      }
    }
  }
  return rows;
}
