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

// 0012 의 placement_points 와 같은 표. 시트에 적힌 점수와 대조하는 데 쓴다.
export function placementPoints(place) {
  if (place === 1) return 10;
  if (place === 2) return 6;
  if (place === 3) return 5;
  if (place === 4) return 4;
  if (place === 5) return 3;
  if (place === 6) return 2;
  if (place === 7 || place === 8) return 1;
  return 0;
}

// 시트는 같은 숫자를 여러 방향으로 다시 적어둔다 — 라운드 점수는 순위에서
// 나오고, 라운드 합계는 점수+킬이며, PLACE/KILL/TOTAL 은 라운드들의 합이다.
// 그 관계를 전부 확인하면 옮겨 적다 틀린 칸이 거의 다 걸린다.
// 확인은 적어준 칸에 대해서만 한다 (선택 항목).
function checkSheetArithmetic(file, problems) {
  const placesByRound = new Map();

  for (const team of file.sheet) {
    let pointsSum = 0;
    let killsSum = 0;

    for (const r of team.rounds) {
      const expected = placementPoints(r.place);
      if (r.points !== undefined && r.points !== expected) {
        problems.push(
          `시트 ${r.round}경기 ${team.teamNo}팀: ${r.place}위면 ${expected}점인데 ${r.points}점으로 적혀 있다`,
        );
      }
      if (r.total !== undefined && r.total !== expected + r.kills) {
        problems.push(
          `시트 ${r.round}경기 ${team.teamNo}팀: ${expected}점 + ${r.kills}킬 = ${expected + r.kills} 인데 합계가 ${r.total} 이다`,
        );
      }
      pointsSum += expected;
      killsSum += r.kills;

      if (!placesByRound.has(r.round)) placesByRound.set(r.round, []);
      placesByRound.get(r.round).push({ teamNo: team.teamNo, place: r.place });
    }

    if (team.placePoints !== undefined && team.placePoints !== pointsSum) {
      problems.push(
        `시트 ${team.teamNo}팀: 라운드 점수 합이 ${pointsSum} 인데 PLACE 칸은 ${team.placePoints} 이다`,
      );
    }
    if (team.totalKills !== undefined && team.totalKills !== killsSum) {
      problems.push(
        `시트 ${team.teamNo}팀: 라운드 킬 합이 ${killsSum} 인데 KILL 칸은 ${team.totalKills} 이다`,
      );
    }
    if (team.total !== undefined && team.total !== pointsSum + killsSum) {
      problems.push(
        `시트 ${team.teamNo}팀: ${pointsSum} + ${killsSum} = ${pointsSum + killsSum} 인데 TOTAL 칸은 ${team.total} 이다`,
      );
    }
  }

  // 한 라운드 안에서 등수는 1..N 이 한 번씩 나와야 한다.
  // 같은 등수를 두 팀에 적었거나 한 팀을 건너뛴 게 여기서 걸린다.
  for (const [round, entries] of placesByRound) {
    const places = entries.map((e) => e.place).sort((a, b) => a - b);
    const expected = entries.map((_, i) => i + 1);
    if (JSON.stringify(places) !== JSON.stringify(expected)) {
      const dupes = places.filter((p, i) => places[i - 1] === p);
      problems.push(
        `시트 ${round}경기: 등수가 1~${entries.length} 한 번씩이 아니다` +
          (dupes.length > 0 ? ` (겹친 등수: ${[...new Set(dupes)].join(', ')})` : ''),
      );
    }
  }
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

  checkSheetArithmetic(file, problems);

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

// 스크린샷에 찍힌 닉네임은 등록된 것과 대소문자나 꼬리 기호가 다를 때가 있다
// (Ez_xijingping ↔ Ez_XiJingPing, Ez_Xapaz ↔ Ez_Xapaz-). 그대로 두면 진짜
// 클랜원의 경기가 조용히 랭킹에서 빠져 평균이 틀어진다.
function normalizeIgn(ign) {
  return ign.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// accounts 는 [{ pubgIgn, memberId }] 다. 정확히 같은 닉네임을 먼저 보고,
// 없으면 정규화해서 찾는다. 정규화 결과가 서로 다른 사람 여럿을 가리키면
// 찍지 않고 비워둔다 — 엉뚱한 사람 지표에 얹는 것보다 빠지는 편이 낫다.
export function buildIgnResolver(accounts) {
  const exact = new Map();
  const byNormalized = new Map();
  for (const { pubgIgn, memberId } of accounts) {
    exact.set(pubgIgn, memberId);
    const key = normalizeIgn(pubgIgn);
    if (!byNormalized.has(key)) byNormalized.set(key, new Set());
    byNormalized.get(key).add(memberId);
  }

  const ambiguous = new Set();

  function resolve(ign) {
    if (exact.has(ign)) return exact.get(ign);
    const candidates = byNormalized.get(normalizeIgn(ign));
    if (!candidates) return null;
    if (candidates.size > 1) {
      ambiguous.add(ign);
      return null;
    }
    return [...candidates][0];
  }

  resolve.ambiguous = ambiguous;
  return resolve;
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
