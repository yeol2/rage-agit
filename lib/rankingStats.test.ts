import { describe, expect, it } from 'vitest';
import {
  MIN_GAMES_FOR_RANKING,
  WIN_PROBABILITY_TEMPERATURE,
  eligibleForRanking,
  topByAvgKills,
  topByWinProbability,
  winProbabilities,
  type RankingStatsRow,
} from './rankingStats';

function row(overrides: Partial<RankingStatsRow> = {}): RankingStatsRow {
  return {
    memberId: 'm-1',
    discordNickname: 'Member1',
    tier: 2,
    totalGameCount: 20,
    avgKills: 2,
    avgPlacementPoints: 4,
    ...overrides,
  };
}

describe('MIN_GAMES_FOR_RANKING', () => {
  it('12경기(내전 3회)다', () => {
    expect(MIN_GAMES_FOR_RANKING).toBe(12);
  });
});

describe('eligibleForRanking', () => {
  it('기준 이상만 남기고 미만은 뺀다', () => {
    const rows = [
      row({ memberId: 'a', totalGameCount: 12 }),
      row({ memberId: 'b', totalGameCount: 11 }),
      row({ memberId: 'c', totalGameCount: 100 }),
    ];
    expect(eligibleForRanking(rows).map((r) => r.memberId)).toEqual(['a', 'c']);
  });
});

describe('topByAvgKills', () => {
  it('평균킬 내림차순으로 정렬해 limit만큼 자른다', () => {
    const rows = [
      row({ memberId: 'a', avgKills: 2 }),
      row({ memberId: 'b', avgKills: 5 }),
      row({ memberId: 'c', avgKills: 3 }),
      row({ memberId: 'd', avgKills: 1 }),
    ];
    expect(topByAvgKills(rows, 3).map((r) => r.memberId)).toEqual(['b', 'c', 'a']);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const rows = [row({ memberId: 'a', avgKills: 2 }), row({ memberId: 'b', avgKills: 5 })];
    const copy = [...rows];
    topByAvgKills(rows);
    expect(rows).toEqual(copy);
  });
});

describe('winProbabilities', () => {
  it('점수가 높을수록 확률도 높다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 6 }),
      row({ memberId: 'b', avgPlacementPoints: 3 }),
      row({ memberId: 'c', avgPlacementPoints: 3 }),
    ];
    const result = winProbabilities(rows, 1.5);
    const byId = Object.fromEntries(result.map((r) => [r.memberId, r.probability]));
    expect(byId.a).toBeGreaterThan(byId.b);
    expect(byId.b).toBeCloseTo(byId.c);
  });

  it('확률의 합은 1이다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 6 }),
      row({ memberId: 'b', avgPlacementPoints: 3 }),
      row({ memberId: 'c', avgPlacementPoints: 1 }),
    ];
    const total = winProbabilities(rows, 1.5).reduce((sum, r) => sum + r.probability, 0);
    expect(total).toBeCloseTo(1);
  });

  it('전원 동점(표준편차 0)이면 균등하게 나눈다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 4 }),
      row({ memberId: 'b', avgPlacementPoints: 4 }),
    ];
    const result = winProbabilities(rows, 1.5);
    expect(result.every((r) => r.probability === 0.5)).toBe(true);
  });

  it('빈 배열이면 빈 배열을 낸다', () => {
    expect(winProbabilities([], 1.5)).toEqual([]);
  });

  it('온도가 높을수록 1위와 나머지의 격차가 커진다', () => {
    const rows = [row({ memberId: 'a', avgPlacementPoints: 6 }), row({ memberId: 'b', avgPlacementPoints: 3 })];
    const low = winProbabilities(rows, 0.5);
    const high = winProbabilities(rows, 3);
    const aLow = low.find((r) => r.memberId === 'a')!.probability;
    const aHigh = high.find((r) => r.memberId === 'a')!.probability;
    expect(aHigh).toBeGreaterThan(aLow);
  });
});

describe('topByWinProbability', () => {
  it('확률 내림차순으로 정렬해 limit만큼 자른다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 8 }),
      row({ memberId: 'b', avgPlacementPoints: 6 }),
      row({ memberId: 'c', avgPlacementPoints: 4 }),
      row({ memberId: 'd', avgPlacementPoints: 2 }),
    ];
    const top = topByWinProbability(rows, 1.5, 3);
    expect(top.map((r) => r.memberId)).toEqual(['a', 'b', 'c']);
    expect(top[0].probability).toBeGreaterThanOrEqual(top[1].probability);
    expect(top[1].probability).toBeGreaterThanOrEqual(top[2].probability);
  });
});

describe('WIN_PROBABILITY_TEMPERATURE', () => {
  it('양수다', () => {
    expect(WIN_PROBABILITY_TEMPERATURE).toBeGreaterThan(0);
  });
});
