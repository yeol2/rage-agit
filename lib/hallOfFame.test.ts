import { describe, expect, it } from 'vitest';
import { dayTotals, rankTop, teamMatchScores, winningScores } from './hallOfFame';

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
