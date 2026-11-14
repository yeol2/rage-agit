import { describe, expect, it } from 'vitest';
import { dayTotals, rankTop, teamMatchScores, winningScores } from './hallOfFame';

const c = (value: number, date = '2026-10-01') => ({ names: ['A'], value, date, map: null, detail: null });

describe('rankTop', () => {
  it('큰 값부터 줄 세우고 동률은 같은 등수, 다음 등수는 건너뛴다', () => {
    const ranked = rankTop([c(5), c(9), c(9), c(7)], 'desc');
    expect(ranked.map((e) => [e.rank, e.value])).toEqual([
      [1, 9],
      [1, 9],
      [3, 7],
      [4, 5],
    ]);
  });

  it('작은 값부터도 세운다(최저 점수 우승)', () => {
    expect(rankTop([c(40), c(35), c(39)], 'asc').map((e) => e.value)).toEqual([35, 39, 40]);
  });

  it('limit 등에 동률이 걸리면 다 넣고, 그 밖은 자른다', () => {
    const many = [10, 9, 8, 8, 8, 1].map((v) => c(v));
    expect(rankTop(many, 'desc', 3).map((e) => [e.rank, e.value])).toEqual([
      [1, 10],
      [2, 9],
      [3, 8],
      [3, 8],
      [3, 8],
    ]);
  });

  it('값이 같으면 먼저 세운 기록(이른 날짜)이 위', () => {
    const ranked = rankTop([c(9, '2026-10-08'), c(9, '2026-10-01')], 'desc');
    expect(ranked.map((e) => e.date)).toEqual(['2026-10-01', '2026-10-08']);
  });
});

describe('dayTotals', () => {
  it('사람 × 날짜로 그날 4경기를 더한다 — 같은 사람이라도 날짜가 다르면 따로 센다', () => {
    const totals = dayTotals([
      { key: 'm1', name: 'Ez_A', date: '2026-10-01', value: 3 },
      { key: 'm1', name: 'Ez_A', date: '2026-10-01', value: 5 },
      { key: 'm1', name: 'Ez_A', date: '2026-10-04', value: 2 },
      { key: 'm2', name: 'Ez_B', date: '2026-10-01', value: 4 },
    ]);
    expect(totals).toEqual([
      { names: ['Ez_A'], value: 8, date: '2026-10-01', map: null, detail: '2경기' },
      { names: ['Ez_A'], value: 2, date: '2026-10-04', map: null, detail: '1경기' },
      { names: ['Ez_B'], value: 4, date: '2026-10-01', map: null, detail: '1경기' },
    ]);
  });
});

describe('teamMatchScores', () => {
  it('팀 점수 = 순위점수 + 팀원 전원 킬(안 묶인 계정 포함)', () => {
    const [team] = teamMatchScores([
      { teamKey: 'g1#3', date: '2026-10-01', map: '에란겔', teamRank: 1, name: 'Ez_A', kills: 7 },
      { teamKey: 'g1#3', date: '2026-10-01', map: '에란겔', teamRank: 1, name: 'guest', kills: 5 },
    ]);
    expect(team).toEqual({
      names: ['Ez_A', 'guest'],
      value: 22,
      date: '2026-10-01',
      map: '에란겔',
      detail: '1등 · 순위 10 + 킬 12',
    });
  });
});

describe('winningScores', () => {
  it('그날 1등 팀원 넷을 한 줄로 묶는다', () => {
    const rows = ['Ez_A', 'Ez_B'].map((name) => ({
      date: '2026-10-01',
      teamNo: 3,
      totalScore: 60,
      placePoints: 30,
      kills: 30,
      name,
    }));
    expect(winningScores(rows)).toEqual([
      { names: ['Ez_A', 'Ez_B'], value: 60, date: '2026-10-01', map: null, detail: '순위 30 + 킬 30' },
    ]);
  });
});
