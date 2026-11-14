import { describe, expect, it } from 'vitest';
import {
  comebackWins,
  dayTotals,
  dealerCandidates,
  rankByTierGroup,
  rankTop,
  singleGameCandidates,
  teamMatchScores,
  winningScores,
} from './hallOfFame';

const c = (value: number, date = '2026-10-01') => ({ players: [{ name: 'A', tier: 2 }], value, date, map: null, detail: null });

describe('rankTop', () => {
  it('큰 값부터 줄 세우고, 같은 기록은 먼저 달성한 사람(이른 날짜)이 위 등수다', () => {
    const ranked = rankTop([c(5), c(9, '2026-10-08'), c(9, '2026-10-01'), c(7)], 'desc');
    expect(ranked.map((e) => [e.rank, e.value, e.date])).toEqual([
      [1, 9, '2026-10-01'],
      [2, 9, '2026-10-08'],
      [3, 7, '2026-10-01'],
      [4, 5, '2026-10-01'],
    ]);
  });

  it('작은 값부터도 세운다(최저 점수 우승)', () => {
    expect(rankTop([c(40), c(35), c(39)], 'asc').map((e) => e.value)).toEqual([35, 39, 40]);
  });

  it('딱 limit 개만 남긴다 — limit 등 뒤에 같은 기록이 더 있어도 자른다', () => {
    const many = [10, 9, 8, 8, 8, 1].map((v, i) => c(v, `2026-10-0${i + 1}`));
    expect(rankTop(many, 'desc', 3).map((e) => [e.rank, e.value, e.date])).toEqual([
      [1, 10, '2026-10-01'],
      [2, 9, '2026-10-02'],
      [3, 8, '2026-10-03'],
    ]);
  });
});

describe('dayTotals', () => {
  it('사람 × 날짜로 그날 4경기를 더한다 — 같은 사람이라도 날짜가 다르면 따로 센다', () => {
    const totals = dayTotals([
      { key: 'm1', name: 'Ez_A', tier: 2, date: '2026-10-01', value: 3 },
      { key: 'm1', name: 'Ez_A', tier: 2, date: '2026-10-01', value: 5 },
      { key: 'm1', name: 'Ez_A', tier: 2, date: '2026-10-04', value: 2 },
      { key: 'm2', name: 'Ez_B', tier: 2, date: '2026-10-01', value: 4 },
    ]);
    expect(totals).toEqual([
      { players: [{ name: 'Ez_A', tier: 2 }], value: 8, date: '2026-10-01', map: null, detail: '2경기' },
      { players: [{ name: 'Ez_A', tier: 2 }], value: 2, date: '2026-10-04', map: null, detail: '1경기' },
      { players: [{ name: 'Ez_B', tier: 2 }], value: 4, date: '2026-10-01', map: null, detail: '1경기' },
    ]);
  });
});

describe('teamMatchScores', () => {
  it('팀 점수 = 순위점수 + 팀원 전원 킬(안 묶인 계정 포함), 팀원은 고티어 → 저티어 순', () => {
    const [team] = teamMatchScores([
      { teamKey: 'g1#3', date: '2026-10-01', map: '에란겔', teamRank: 1, name: 'guest', tier: null, kills: 0 },
      { teamKey: 'g1#3', date: '2026-10-01', map: '에란겔', teamRank: 1, name: 'Ez_A', tier: 3.5, kills: 7 },
      { teamKey: 'g1#3', date: '2026-10-01', map: '에란겔', teamRank: 1, name: 'Ez_C', tier: 0, kills: 5 },
    ]);
    expect(team).toEqual({
      players: [
        { name: 'Ez_C', tier: 0 },
        { name: 'Ez_A', tier: 3.5 },
        { name: 'guest', tier: null },
      ],
      value: 22,
      date: '2026-10-01',
      map: '에란겔',
      detail: '1등 · 순위 점수 10 + 킬 점수 12',
    });
  });
});

describe('winningScores', () => {
  it('그날 1등 팀원 넷을 한 줄로 묶고, 고티어 → 저티어 순으로 세운다', () => {
    const rows = [
      ['Ez_A', 4],
      ['Ez_B', 1.5],
    ].map(([name, tier]) => ({
      date: '2026-10-01',
      teamNo: 3,
      totalScore: 60,
      placePoints: 30,
      kills: 30,
      name: name as string,
      tier: tier as number,
    }));
    expect(winningScores(rows)).toEqual([
      {
        players: [
          { name: 'Ez_B', tier: 1.5 },
          { name: 'Ez_A', tier: 4 },
        ],
        value: 60, date: '2026-10-01', map: null, detail: '순위 점수 30 + 킬 점수 30' },
    ]);
  });
});

describe('rankByTierGroup', () => {
  const p = (name: string, tier: number | null, value: number) => ({
    players: [{ name, tier }],
    value,
    date: '2026-10-01',
    map: null,
    detail: null,
  });
  const groups = [
    { id: 'all', label: '전체', tiers: null },
    { id: '0-1.5', label: '0~1.5티어', tiers: [0, 1, 1.5] },
    { id: '3-3.5', label: '3~3.5티어', tiers: [3, 3.5] },
  ];

  it('지금 티어로 그룹을 갈라 그룹마다 1등부터 다시 매긴다(전체는 다 섞어서)', () => {
    const result = rankByTierGroup([p('A', 0, 20), p('B', 3.5, 18), p('C', 1.5, 15), p('X', null, 30)], 'desc', groups);
    expect(result.map((g) => [g.id, g.entries.map((e) => `${e.rank}.${e.players[0].name}`)])).toEqual([
      ['all', ['1.X', '2.A', '3.B', '4.C']],
      ['0-1.5', ['1.A', '2.C']],
      ['3-3.5', ['1.B']],
    ]);
  });
});

describe('singleGameCandidates', () => {
  it('한 경기 한 사람이 그대로 후보 하나 — 더하지 않고, 날짜·맵·그 경기 팀 순위를 단다', () => {
    const rows = [
      { name: 'Ez_A', tier: 1, date: '2026-09-17', map: '에란겔', teamRank: 3, value: 14 },
      { name: 'Ez_A', tier: 1, date: '2026-09-17', map: '미라마', teamRank: 1, value: 6 },
    ];
    expect(rankTop(singleGameCandidates(rows), 'desc').map((e) => [e.rank, e.value, e.map, e.detail])).toEqual([
      [1, 14, '에란겔', '팀 3등'],
      [2, 6, '미라마', '팀 1등'],
    ]);
  });
});

describe('dealerCandidates', () => {
  it('딜 − 킬 × 기준딜로 줄 세우고, 화면엔 "N킬 M딜"을 그대로 적는다', () => {
    const rows = [
      { name: 'A', tier: 1, date: '2026-10-01', map: '에란겔', kills: 1, damage: 990 },
      { name: 'B', tier: 2, date: '2026-10-01', map: '미라마', kills: 2, damage: 694 },
      { name: 'C', tier: 3, date: '2026-10-01', map: '론도', kills: 9, damage: 1200 },
    ];
    // 990 − 75 = 915, 694 − 150 = 544, 1200 − 675 = 525 — 딜이 제일 많은 9킬보다
    // 킬 대비 딜이 많은 1킬·2킬이 위다.
    expect(rankTop(dealerCandidates(rows, 75), 'desc').map((e) => [e.valueLabel, e.value])).toEqual([
      ['1킬 990딜', 915],
      ['2킬 694딜', 544],
      ['9킬 1,200딜', 525],
    ]);
  });
});

describe('comebackWins', () => {
  // 3팀, 4라운드. 1번팀이 3라운드까지 앞서다가 4라운드에 3번팀이 뒤집는다.
  const round = (rows: [team: number, rank: number, kills: number][]) =>
    rows.map(([teamNumber, teamRank, kills]) => ({ teamNumber, teamRank, kills }));
  const rounds = [
    round([[1, 1, 5], [2, 2, 2], [3, 3, 0]]), // 1: 15, 2: 8, 3: 5
    round([[1, 1, 5], [2, 2, 2], [3, 3, 0]]), // 1: 30, 2: 16, 3: 10
    round([[1, 2, 0], [2, 3, 0], [3, 1, 0]]), // 1: 36, 2: 21, 3: 20  → 3번팀 3R 3등
    round([[1, 16, 0], [2, 16, 0], [3, 1, 20]]), // 3번팀 50 으로 우승
  ];
  const playersByTeam = new Map([[3, [{ name: 'Ez_low', tier: 4 }, { name: 'Ez_high', tier: 1 }]]]);

  it('3라운드 순위 → 우승을 적고, 팀원은 고티어부터', () => {
    const [entry] = comebackWins([
      { date: '2026-10-01', rounds, playersByTeam, recordedTotals: new Map([[1, 36], [2, 21], [3, 50]]) },
    ]);
    expect(entry.valueLabel).toBe('3R 3등 → 우승');
    expect(entry.value).toBe(3);
    expect(entry.detail).toBe('3R 1등과 16점 차 · 최종 50점');
    expect(entry.players.map((p) => p.name)).toEqual(['Ez_high', 'Ez_low']);
  });

  it('저장된 팀 총점과 다시 계산한 총점이 다르면(데이터가 빠진 날) 그날은 뺀다', () => {
    expect(
      comebackWins([{ date: '2026-10-01', rounds, playersByTeam, recordedTotals: new Map([[3, 58]]) }]),
    ).toEqual([]);
    expect(comebackWins([{ date: '2026-10-01', rounds, playersByTeam }])).toEqual([]);
  });

  it('3라운드에도 1등이던 우승은 역전이 아니다', () => {
    const steady = rounds.slice(0, 3).concat([round([[1, 1, 0], [2, 2, 0], [3, 3, 0]])]);
    expect(
      comebackWins([{ date: '2026-10-01', rounds: steady, playersByTeam, recordedTotals: new Map([[1, 46]]) }]),
    ).toEqual([]);
  });
});
