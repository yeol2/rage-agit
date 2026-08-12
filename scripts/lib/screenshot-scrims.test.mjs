import { describe, expect, it } from 'vitest';
import { buildIgnResolver, buildRows, clanShare, crossCheck, validateFile } from './screenshot-scrims.mjs';

// 2팀·2라운드짜리 최소 표본. 실제 파일은 16팀 × 3~4라운드다.
function file(overrides = {}) {
  return {
    scrimDate: '2026-05-10',
    sheetFile: '126_sheet.jpg',
    sheet: [
      {
        teamNo: 3,
        rounds: [
          { round: 1, place: 1, kills: 8 },
          { round: 2, place: 2, kills: 2 },
        ],
      },
      {
        teamNo: 7,
        rounds: [
          { round: 1, place: 2, kills: 3 },
          { round: 2, place: 1, kills: 6 },
        ],
      },
    ],
    matches: [
      {
        round: 1,
        sourceFile: '133_ingame.jpg',
        teams: [
          {
            teamNo: 3,
            place: 1,
            players: [
              { ign: 'Ez_A', kills: 3 },
              { ign: 'Ez_B', kills: 3 },
              { ign: 'Ez_C', kills: 1 },
              { ign: 'Ez_D', kills: 1 },
            ],
          },
          {
            teamNo: 7,
            place: 2,
            players: [
              { ign: 'Ez_E', kills: 2 },
              { ign: 'Ez_F', kills: 1 },
              { ign: 'Ez_G', kills: 0 },
              { ign: 'Ez_H', kills: 0 },
            ],
          },
        ],
      },
      {
        round: 2,
        sourceFile: '131_ingame.jpg',
        teams: [
          {
            teamNo: 3,
            place: 2,
            players: [
              { ign: 'Ez_A', kills: 2 },
              { ign: 'Ez_B', kills: 0 },
              { ign: 'Ez_C', kills: 0 },
              { ign: 'Ez_D', kills: 0 },
            ],
          },
          {
            teamNo: 7,
            place: 1,
            players: [
              { ign: 'Ez_E', kills: 3 },
              { ign: 'Ez_F', kills: 2 },
              { ign: 'Ez_G', kills: 1 },
              { ign: 'Ez_H', kills: 0 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('validateFile', () => {
  it('제대로 된 파일은 통과시킨다', () => {
    expect(() => validateFile(file())).not.toThrow();
  });

  it('날짜 형식이 틀리면 막는다', () => {
    expect(() => validateFile(file({ scrimDate: '2026/05/10' }))).toThrow(/scrimDate/);
  });

  it('한 매치 안에 같은 등수가 두 번 나오면 막는다', () => {
    const f = file();
    f.matches[0].teams[1].place = 1;
    expect(() => validateFile(f)).toThrow(/등수/);
  });

  it('한 매치 안에 같은 팀이 두 번 나오면 막는다', () => {
    const f = file();
    f.matches[0].teams[1].teamNo = 3;
    expect(() => validateFile(f)).toThrow(/팀 번호/);
  });

  it('킬이 음수면 막는다', () => {
    const f = file();
    f.matches[0].teams[0].players[0].kills = -1;
    expect(() => validateFile(f)).toThrow(/kills/);
  });

  it('닉네임이 비면 막는다', () => {
    const f = file();
    f.matches[0].teams[0].players[0].ign = '';
    expect(() => validateFile(f)).toThrow(/ign/);
  });

  it('같은 매치에 같은 닉네임이 두 번 나오면 막는다', () => {
    const f = file();
    f.matches[0].teams[1].players[0].ign = 'Ez_A';
    expect(() => validateFile(f)).toThrow(/닉네임/);
  });
});

describe('crossCheck', () => {
  it('시트와 인게임이 맞으면 문제를 안 낸다', () => {
    expect(crossCheck(file())).toEqual([]);
  });

  it('팀 킬 합계가 시트와 다르면 잡아낸다', () => {
    const f = file();
    f.matches[0].teams[0].players[0].kills = 2; // 합계 8 → 7
    const problems = crossCheck(f);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/1경기.*3팀.*8.*7/);
  });

  it('팀 등수가 시트와 다르면 잡아낸다', () => {
    const f = file();
    f.matches[1].teams[0].place = 4; // 시트는 2
    const problems = crossCheck(f);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/등수/);
  });

  it('시트에 있는 팀이 인게임에 없으면 잡아낸다', () => {
    const f = file();
    f.matches[0].teams.splice(1, 1);
    const problems = crossCheck(f);
    expect(problems.some((p) => /7팀.*없다/.test(p))).toBe(true);
  });

  it('시트에 없는 라운드가 인게임에 있으면 잡아낸다', () => {
    const f = file();
    f.matches.push({ round: 3, sourceFile: 'x.jpg', teams: [] });
    const problems = crossCheck(f);
    expect(problems.some((p) => /3경기/.test(p))).toBe(true);
  });
});

describe('crossCheck — 시트 자체의 검산', () => {
  it('순위와 점수가 안 맞으면 잡아낸다', () => {
    const f = file();
    f.sheet[0].rounds[0].points = 6; // 1위면 10점이어야 한다
    expect(crossCheck(f).some((p) => /1위면 10점/.test(p))).toBe(true);
  });

  it('점수 + 킬 이 합계와 안 맞으면 잡아낸다', () => {
    const f = file();
    f.sheet[0].rounds[0].total = 17; // 10 + 8 = 18
    expect(crossCheck(f).some((p) => /합계가 17/.test(p))).toBe(true);
  });

  it('라운드 점수 합이 PLACE 칸과 안 맞으면 잡아낸다', () => {
    const f = file();
    f.sheet[0].placePoints = 15; // 1위(10) + 2위(6) = 16
    expect(crossCheck(f).some((p) => /PLACE 칸은 15/.test(p))).toBe(true);
  });

  it('라운드 킬 합이 KILL 칸과 안 맞으면 잡아낸다', () => {
    const f = file();
    f.sheet[0].totalKills = 9; // 8 + 2 = 10
    expect(crossCheck(f).some((p) => /KILL 칸은 9/.test(p))).toBe(true);
  });

  it('TOTAL 칸이 안 맞으면 잡아낸다', () => {
    const f = file();
    f.sheet[0].total = 25; // 16 + 10 = 26
    expect(crossCheck(f).some((p) => /TOTAL 칸은 25/.test(p))).toBe(true);
  });

  it('한 라운드에 같은 등수가 두 번 나오면 잡아낸다', () => {
    const f = file();
    f.sheet[1].rounds[0].place = 1; // 이미 3팀이 1위
    f.matches[0].teams[1].place = 1;
    expect(crossCheck(f).some((p) => /겹친 등수: 1/.test(p))).toBe(true);
  });

  it('검산 칸을 안 적어도 통과한다 (선택 항목이다)', () => {
    expect(crossCheck(file())).toEqual([]);
  });

  it('검산 칸을 다 적고 맞으면 통과한다', () => {
    const f = file();
    f.sheet[0].placePoints = 16; // 1위(10) + 2위(6)
    f.sheet[0].totalKills = 10; // 8 + 2
    f.sheet[0].total = 26;
    f.sheet[0].rounds[0].points = 10;
    f.sheet[0].rounds[0].total = 18; // 10 + 8
    f.sheet[0].rounds[1].points = 6;
    f.sheet[0].rounds[1].total = 8; // 6 + 2
    expect(crossCheck(f)).toEqual([]);
  });
});

describe('buildRows', () => {
  const resolve = (ign) => (ign === 'Ez_A' ? 'member-a' : null);

  it('선수 한 명당 매치 한 줄씩 낸다', () => {
    const rows = buildRows(file(), resolve);
    expect(rows).toHaveLength(16); // 2라운드 × 2팀 × 4명
  });

  it('알아본 닉네임에는 member_id 를 붙이고 못 알아보면 null 로 둔다', () => {
    const rows = buildRows(file(), resolve);
    expect(rows.find((r) => r.pubg_ign === 'Ez_A').member_id).toBe('member-a');
    expect(rows.find((r) => r.pubg_ign === 'Ez_B').member_id).toBeNull();
  });

  it('팀 등수를 그 팀 선수 전원에게 붙인다', () => {
    const rows = buildRows(file(), resolve);
    const team3Round1 = rows.filter((r) => r.round_no === 1 && r.team_no === 3);
    expect(team3Round1).toHaveLength(4);
    expect(team3Round1.every((r) => r.team_rank === 1)).toBe(true);
  });

  it('날짜와 출처 파일을 남긴다', () => {
    const rows = buildRows(file(), resolve);
    expect(rows[0].scrim_date).toBe('2026-05-10');
    expect(rows[0].source_file).toBe('133_ingame.jpg');
  });
});

describe('buildIgnResolver', () => {
  const accounts = [
    { pubgIgn: 'Ez_XiJingPing', memberId: 'm-xi' },
    { pubgIgn: 'Ez_Xapaz-', memberId: 'm-xavi' },
    { pubgIgn: 'Ez_Daks', memberId: 'm-daks' },
    { pubgIgn: 'Ez_ekrtm', memberId: 'm-daks' }, // 같은 사람의 부계정
  ];

  it('정확히 같은 닉네임을 찾는다', () => {
    expect(buildIgnResolver(accounts)('Ez_XiJingPing')).toBe('m-xi');
  });

  it('부계정도 본계정과 같은 사람으로 묶는다', () => {
    const resolve = buildIgnResolver(accounts);
    expect(resolve('Ez_ekrtm')).toBe('m-daks');
    expect(resolve('Ez_Daks')).toBe('m-daks');
  });

  it('대소문자만 다르면 찾아준다', () => {
    expect(buildIgnResolver(accounts)('Ez_xijingping')).toBe('m-xi');
  });

  it('꼬리 기호만 다르면 찾아준다', () => {
    expect(buildIgnResolver(accounts)('Ez_Xapaz')).toBe('m-xavi');
  });

  it('아예 없는 닉네임은 null', () => {
    expect(buildIgnResolver(accounts)('Ez_Nobody')).toBeNull();
  });

  it('정규화 결과가 서로 다른 사람을 가리키면 찍지 않고 기록해둔다', () => {
    const resolve = buildIgnResolver([
      { pubgIgn: 'Ez_Sun', memberId: 'm-1' },
      { pubgIgn: 'Ez_S_U_N', memberId: 'm-2' },
    ]);
    expect(resolve('Ez_sun')).toBeNull();
    expect(resolve.ambiguous.has('Ez_sun')).toBe(true);
  });

  it('정확히 같은 닉네임이 있으면 모호해도 그걸 쓴다', () => {
    const resolve = buildIgnResolver([
      { pubgIgn: 'Ez_Sun', memberId: 'm-1' },
      { pubgIgn: 'Ez_S_U_N', memberId: 'm-2' },
    ]);
    expect(resolve('Ez_Sun')).toBe('m-1');
  });
});

describe('clanShare', () => {
  it('전원이 Ez 로 시작하면 1', () => {
    expect(clanShare(file())).toBe(1);
  });

  it('클랜 대항전처럼 남의 클랜이 섞이면 절반 아래로 떨어진다', () => {
    const f = file();
    // 8명 중 6명을 다른 클랜 닉네임으로 바꾼다. 두 라운드에 같은 사람이
    // 나오므로 이름을 대응표로 바꿔야 한 사람이 둘로 세어지지 않는다.
    const renamed = { Ez_A: 'Xx_A', Ez_B: 'Xx_B', Ez_C: 'Xx_C', Ez_D: 'Xx_D', Ez_E: 'Xx_E', Ez_F: 'Xx_F' };
    for (const m of f.matches) {
      for (const t of m.teams) {
        for (const p of t.players) p.ign = renamed[p.ign] ?? p.ign;
      }
    }
    expect(clanShare(f)).toBeCloseTo(0.25);
    expect(clanShare(f)).toBeLessThan(0.5);
  });
});
