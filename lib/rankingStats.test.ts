import { MIN_SCRIMS_FOR_RANKING, matchesFor } from './scrimCounting';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_WITHIN_MONTHS,
  
  RAGE_SCORE_STEEPNESS,
  TIER_KILL_WEIGHTS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  rageScores,
  topByAvgKills,
  topByAvgRank,
  topByRageScore,
  type RankingStatsRow,
} from './rankingStats';

// 테스트용 고정 티어 밴드. 기본 row()의 tier(2)가 이 밴드 안에 들어간다.
const BANDS = [[2, 2.5]];

function row(overrides: Partial<RankingStatsRow> = {}): RankingStatsRow {
  return {
    memberId: 'm-1',
    discordNickname: 'Member1',
    tier: 2,
    totalGameCount: 20,
    windowGameCount: 20,
    avgKills: 2,
    avgPlacementPoints: 4,
    avgRank: 5,
    lastPlayedAt: new Date().toISOString(),
    winCount: 0,
    ...overrides,
  };
}

describe('집계 자격', () => {
  // 자격은 내전 회차로 정하고 경기 수는 거기서 파생한다(lib/scrimCounting.ts).
  // 화면이 "내전 4회"라고 적어놓고 코드가 다른 수를 세는 일이 없게 묶어둔다.
  it('내전 4회 = 16경기다', () => {
    expect(MIN_SCRIMS_FOR_RANKING).toBe(4);
    expect(matchesFor(MIN_SCRIMS_FOR_RANKING)).toBe(16);
  });
});

describe('TIER_SCORE_BANDS', () => {
  it('전체 탭을 뺀 티어 그룹 4개와 같은 개수다', () => {
    expect(TIER_SCORE_BANDS.length).toBe(4);
  });
});

describe('eligibleForRanking', () => {
  it('기준 이상만 남기고 미만은 뺀다', () => {
    const rows = [
      row({ memberId: 'a', totalGameCount: 16 }),
      row({ memberId: 'b', totalGameCount: 15 }),
      row({ memberId: 'c', totalGameCount: 100 }),
    ];
    expect(eligibleForRanking(rows).map((r) => r.memberId)).toEqual(['a', 'c']);
  });

  it(`최근 ${ACTIVE_WITHIN_MONTHS}개월 이내 참가 기록이 없으면 통산 경기수를 채워도 뺀다`, () => {
    const now = new Date('2026-08-14T00:00:00Z');
    const withinWindow = new Date(now);
    withinWindow.setMonth(withinWindow.getMonth() - ACTIVE_WITHIN_MONTHS + 1);
    const beforeWindow = new Date(now);
    beforeWindow.setMonth(beforeWindow.getMonth() - ACTIVE_WITHIN_MONTHS - 1);

    const rows = [
      row({ memberId: 'active', lastPlayedAt: withinWindow.toISOString() }),
      row({ memberId: 'inactive', lastPlayedAt: beforeWindow.toISOString() }),
    ];
    expect(eligibleForRanking(rows, now).map((r) => r.memberId)).toEqual(['active']);
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

describe('topByAvgRank', () => {
  it('평균등수 오름차순(1등에 가까울수록 상위)으로 정렬해 limit만큼 자른다', () => {
    const rows = [
      row({ memberId: 'a', avgRank: 5 }),
      row({ memberId: 'b', avgRank: 2 }),
      row({ memberId: 'c', avgRank: 8 }),
      row({ memberId: 'd', avgRank: 1 }),
    ];
    expect(topByAvgRank(rows, 3).map((r) => r.memberId)).toEqual(['d', 'b', 'a']);
  });
});

describe('rageScores', () => {
  it('종합점수가 높을수록 점수도 높다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 6 }),
      row({ memberId: 'b', avgPlacementPoints: 3 }),
      row({ memberId: 'c', avgPlacementPoints: 3 }),
    ];
    const result = rageScores(rows, BANDS, 1.5);
    const byId = Object.fromEntries(result.map((r) => [r.memberId, r.score]));
    expect(byId.a).toBeGreaterThan(byId.b);
    expect(byId.b).toBeCloseTo(byId.c);
  });

  it('밴드 평균인 사람은 항상 50점이다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 6 }),
      row({ memberId: 'b', avgPlacementPoints: 2 }),
    ];
    const result = rageScores(rows, BANDS, 1.5);
    const byId = Object.fromEntries(result.map((r) => [r.memberId, r.score]));
    expect(byId.a + byId.b).toBeCloseTo(100); // 대칭 분포라 평균에서 서로 대칭
  });

  it('점수는 0~100 사이에 있다(절대 0이나 100은 안 된다)', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 100 }),
      row({ memberId: 'b', avgPlacementPoints: 0 }),
      row({ memberId: 'c', avgPlacementPoints: 3 }),
    ];
    const result = rageScores(rows, BANDS, 1.5);
    for (const r of result) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThan(100);
    }
  });

  it('밴드 전원 동점(표준편차 0)이면 전원 50점이다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 4 }),
      row({ memberId: 'b', avgPlacementPoints: 4 }),
    ];
    const result = rageScores(rows, BANDS, 1.5);
    expect(result.every((r) => r.score === 50)).toBe(true);
  });

  it('빈 배열이면 빈 배열을 낸다', () => {
    expect(rageScores([], BANDS, 1.5)).toEqual([]);
  });

  it('배치점수가 같아도 평균킬이 높으면 점수가 더 높다(등수점수+킬 합산)', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 4, avgKills: 5 }),
      row({ memberId: 'b', avgPlacementPoints: 4, avgKills: 1 }),
    ];
    const result = rageScores(rows, BANDS, 1.5);
    const byId = Object.fromEntries(result.map((r) => [r.memberId, r.score]));
    expect(byId.a).toBeGreaterThan(byId.b);
  });

  it('기울기(steepness)가 클수록 1위와 나머지의 격차가 커진다', () => {
    const rows = [row({ memberId: 'a', avgPlacementPoints: 6 }), row({ memberId: 'b', avgPlacementPoints: 3 })];
    const low = rageScores(rows, BANDS, 0.5);
    const high = rageScores(rows, BANDS, 3);
    const aLow = low.find((r) => r.memberId === 'a')!.score;
    const aHigh = high.find((r) => r.memberId === 'a')!.score;
    expect(aHigh).toBeGreaterThan(aLow);
  });

  it('서로 다른 밴드는 따로 계산한다 — 다른 밴드 인원은 내 z-score에 영향을 안 준다', () => {
    const bands = [[2], [4]];
    const rows = [
      row({ memberId: 'a', tier: 2, avgPlacementPoints: 6 }),
      row({ memberId: 'b', tier: 2, avgPlacementPoints: 2 }),
      row({ memberId: 'c', tier: 4, avgPlacementPoints: 100 }), // 다른 밴드의 극단값
    ];
    const result = rageScores(rows, bands, 1.5);
    const byId = Object.fromEntries(result.map((r) => [r.memberId, r.score]));
    // c가 아무리 극단적이어도 a/b의 점수(밴드 [2] 안에서만 계산)는 그대로다.
    expect(byId.a).toBeCloseTo(rageScores([rows[0], rows[1]], [[2]], 1.5)[0].score);
  });

  it('어느 밴드에도 안 속하는 사람은 결과에서 빠진다', () => {
    const rows = [row({ memberId: 'a', tier: 9 })];
    expect(rageScores(rows, BANDS, 1.5)).toEqual([]);
  });

  it('배치점수 우위인 사람과 킬 우위인 사람의 순위가 티어 밴드별 킬 가중치에 따라 뒤바뀐다', () => {
    // A: 배치점수 높고 킬 적음(등수형) / B: 배치점수 낮고 킬 많음(교전형).
    // 같은 두 스탯 조합이라도 0~1.5티어(가중치 1)에서는 A가 앞서고,
    // 4~5티어(가중치 3.25)에서는 킬 비중이 커져 B가 앞선다.
    const a = { avgPlacementPoints: 6, avgKills: 1 };
    const b = { avgPlacementPoints: 2, avgKills: 3 };

    const highTierResult = rageScores(
      [row({ memberId: 'a', tier: 1, ...a }), row({ memberId: 'b', tier: 1, ...b })],
      TIER_SCORE_BANDS,
      RAGE_SCORE_STEEPNESS,
    );
    const lowTierResult = rageScores(
      [row({ memberId: 'a', tier: 4.5, ...a }), row({ memberId: 'b', tier: 4.5, ...b })],
      TIER_SCORE_BANDS,
      RAGE_SCORE_STEEPNESS,
    );

    const highById = Object.fromEntries(highTierResult.map((r) => [r.memberId, r.score]));
    const lowById = Object.fromEntries(lowTierResult.map((r) => [r.memberId, r.score]));
    expect(highById.a).toBeGreaterThan(highById.b);
    expect(lowById.b).toBeGreaterThan(lowById.a);
  });

  it('TIER_KILL_WEIGHTS는 TIER_SCORE_BANDS와 같은 개수, 오름차순(1, 1.75, 2.5, 3.25)이다', () => {
    expect(TIER_KILL_WEIGHTS.length).toBe(TIER_SCORE_BANDS.length);
    expect(TIER_KILL_WEIGHTS).toEqual([1, 1.75, 2.5, 3.25]);
  });
});

describe('topByRageScore', () => {
  it('점수 내림차순으로 정렬해 limit만큼 자른다', () => {
    const rows = [
      row({ memberId: 'a', avgPlacementPoints: 8 }),
      row({ memberId: 'b', avgPlacementPoints: 6 }),
      row({ memberId: 'c', avgPlacementPoints: 4 }),
      row({ memberId: 'd', avgPlacementPoints: 2 }),
    ];
    const top = topByRageScore(rows, BANDS, 1.5, 3);
    expect(top.map((r) => r.memberId)).toEqual(['a', 'b', 'c']);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    expect(top[1].score).toBeGreaterThanOrEqual(top[2].score);
  });
});

describe('RAGE_SCORE_STEEPNESS', () => {
  it('양수다', () => {
    expect(RAGE_SCORE_STEEPNESS).toBeGreaterThan(0);
  });
});
