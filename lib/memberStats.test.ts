import { describe, expect, it } from 'vitest';
import {
  ALL_TIERS,
  MEMBER_STAT_TIER_GROUPS,
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  cleanDisplayName,
  fixedNameplateStyle,
  stripTrailingKoreanTag,
  tierColorRamp,
  tierGroupFor,
  tierNameplateSelectedStyle,
  tierNameplateStyle,
  type MemberRecentStatsRow,
  HEXAGON_AVERAGE_PERCENT,
} from './memberStats';

function row(overrides: Partial<MemberRecentStatsRow>): MemberRecentStatsRow {
  return {
    memberId: 'm-1',
    tier: 2,
    gameCount: 10,
    avgDamage: 200,
    avgKills: 2,
    rankStddev: 3,
    avgSurvival: 1200,
    avgAssists: 1,
    avgRank: 5,
    ...overrides,
  };
}

describe('MEMBER_STAT_TIER_GROUPS', () => {
  it('4개 그룹으로 나누고 5티어를 4~4.5 그룹에 합친다', () => {
    expect(MEMBER_STAT_TIER_GROUPS.map((g) => g.label)).toEqual([
      '0~1.5티어',
      '2~2.5티어',
      '3~3.5티어',
      '4~5티어',
    ]);
    expect(MEMBER_STAT_TIER_GROUPS.find((g) => g.id === '4-5')?.tiers).toEqual([4, 4.5, 5]);
  });
});

describe('tierGroupFor', () => {
  it('티어 값으로 그룹을 찾는다', () => {
    expect(tierGroupFor(0)?.id).toBe('0-1.5');
    expect(tierGroupFor(1.5)?.id).toBe('0-1.5');
    expect(tierGroupFor(2.5)?.id).toBe('2-2.5');
    expect(tierGroupFor(5)?.id).toBe('4-5');
  });

  it('어느 그룹에도 없는 티어면 null', () => {
    expect(tierGroupFor(9)).toBeNull();
  });
});

describe('buildHexagonAxes', () => {
  const target = row({ avgDamage: 200, avgKills: 2, rankStddev: 2, avgSurvival: 1200, avgAssists: 1, avgRank: 5 });
  const cohort = [
    target,
    row({ memberId: 'm-2', avgDamage: 100, avgKills: 1, rankStddev: 5, avgSurvival: 600, avgAssists: 0, avgRank: 10 }),
  ];

  it('6축을 정해진 순서와 라벨로 낸다', () => {
    const axes = buildHexagonAxes(target, cohort);
    expect(axes.map((a) => a.key)).toEqual(['damage', 'kills', 'stability', 'survival', 'assists', 'rank']);
    expect(axes.map((a) => a.label)).toEqual(['딜량', '킬', '안정성', '생존', '어시', '순위']);
  });

  // 이 표본은 두 명이 평균에서 정확히 1 표준편차씩 떨어져 있어, 잘하는 쪽은
  // 모든 축에서 같은 자리(상한 96%)에 놓인다.
  it('본인이 코호트 중 전부 앞서면 모든 축이 바깥 끝이다', () => {
    const axes = buildHexagonAxes(target, cohort);
    expect(axes.every((a) => a.percent === 96)).toBe(true);
  });

  it('평균과 같은 값이면 정확히 한가운데다 — 평균 도형이 정육각형인 근거', () => {
    const middle = row({ avgDamage: 150, avgKills: 1.5, rankStddev: 3.5, avgSurvival: 900, avgAssists: 0.5, avgRank: 7.5 });
    const axes = buildHexagonAxes(middle, cohort);
    expect(axes.every((a) => a.percent === HEXAGON_AVERAGE_PERCENT)).toBe(true);
  });

  it('안정성과 순위는 값이 작을수록 바깥이다', () => {
    const steady = row({ ...target, rankStddev: 5, avgRank: 10 });
    const axes = buildHexagonAxes(steady, cohort);
    expect(axes.find((a) => a.key === 'stability')!.percent).toBe(4);
    expect(axes.find((a) => a.key === 'rank')!.percent).toBe(4);
  });

  it('툴팁에 쓸 내 값과 평균값을 단위까지 붙여 낸다', () => {
    const axes = buildHexagonAxes(target, cohort);
    const damage = axes.find((a) => a.key === 'damage')!;
    expect(damage.valueText).toBe('200딜');
    expect(damage.averageText).toBe('150딜');
    // 생존은 초로 들어와 분으로 나간다.
    expect(axes.find((a) => a.key === 'survival')!.valueText).toBe('20.0분');
    expect(axes.find((a) => a.key === 'rank')!.averageText).toBe('7.5등');
  });

  it('rankStddev 가 null 인 코호트 구성원은 안정성 비교 대상에서 뺀다', () => {
    const withNull = [...cohort, row({ memberId: 'm-3', rankStddev: null })];
    const axes = buildHexagonAxes(target, withNull);
    // null 이 낀 것과 무관하게 [2, 5] 기준 그대로다.
    expect(axes.find((a) => a.key === 'stability')!.averageText).toBe('±3.50등');
  });

  it('본인의 rankStddev 가 null 이면 도형을 평균 자리에 놓고 기록 없음이라 적는다', () => {
    const nullTarget = row({ rankStddev: null });
    const axes = buildHexagonAxes(nullTarget, [nullTarget, ...cohort]);
    const stability = axes.find((a) => a.key === 'stability')!;
    expect(stability.percent).toBe(HEXAGON_AVERAGE_PERCENT);
    expect(stability.valueText).toBe('기록 없음');
  });
});
