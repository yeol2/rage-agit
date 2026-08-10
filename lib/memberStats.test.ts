import { describe, expect, it } from 'vitest';
import {
  MEMBER_STAT_TIER_GROUPS,
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  percentile,
  tierGroupFor,
  type MemberRecentStatsRow,
} from './memberStats';

function row(overrides: Partial<MemberRecentStatsRow>): MemberRecentStatsRow {
  return {
    memberId: 'm-1',
    tier: 2,
    gameCount: 10,
    avgDamage: 200,
    avgKills: 2,
    headshotRatio: 0.3,
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

describe('percentile', () => {
  it('높을수록 좋은 지표에서 최댓값은 100', () => {
    expect(percentile(300, [100, 200, 300], true)).toBe(100);
  });

  it('높을수록 좋은 지표에서 최솟값은 낮은 백분위', () => {
    // 3명 중 자기 자신 포함 1명만 이하이므로 1/3 = 33%
    expect(percentile(100, [100, 200, 300], true)).toBe(33);
  });

  it('낮을수록 좋은 지표(등수)는 방향을 뒤집는다', () => {
    // 등수 1(1등)이 가장 좋다 — 셋 다 자기 이상이므로 100
    expect(percentile(1, [1, 5, 10], false)).toBe(100);
    // 등수 10(꼴등)은 자기 이상인 게 자기 하나뿐 — 33%
    expect(percentile(10, [1, 5, 10], false)).toBe(33);
  });

  it('비교 대상이 없으면 0', () => {
    expect(percentile(100, [], true)).toBe(0);
  });

  it('NaN 이나 무한대는 비교 대상에서 뺀다', () => {
    expect(percentile(100, [100, NaN, 200], true)).toBe(50);
  });
});

describe('buildHexagonAxes', () => {
  const target = row({ avgDamage: 200, avgKills: 2, headshotRatio: 0.3, avgSurvival: 1200, avgAssists: 1, avgRank: 5 });
  const cohort = [
    target,
    row({ memberId: 'm-2', avgDamage: 100, avgKills: 1, headshotRatio: 0.1, avgSurvival: 600, avgAssists: 0, avgRank: 10 }),
  ];

  it('6축을 정해진 순서와 라벨로 낸다', () => {
    const axes = buildHexagonAxes(target, cohort);
    expect(axes.map((a) => a.key)).toEqual(['damage', 'kills', 'headshot', 'survival', 'assists', 'rank']);
    expect(axes.map((a) => a.label)).toEqual(['화력', '결정력', '정확도', '생존력', '팀 기여', '성적']);
  });

  it('본인이 코호트 중 전부 앞서면 모든 축이 100', () => {
    const axes = buildHexagonAxes(target, cohort);
    expect(axes.every((a) => a.percentile === 100)).toBe(true);
  });

  it('headshotRatio 가 null 인 코호트 구성원은 정확도 비교 대상에서 뺀다', () => {
    const withNull = [...cohort, row({ memberId: 'm-3', headshotRatio: null })];
    const axes = buildHexagonAxes(target, withNull);
    const headshotAxis = axes.find((a) => a.key === 'headshot')!;
    expect(headshotAxis.percentile).toBe(100); // null 이 낀 것과 무관하게 그대로
  });

  it('본인의 headshotRatio 가 null 이면 정확도는 0', () => {
    const nullTarget = row({ headshotRatio: null });
    const axes = buildHexagonAxes(nullTarget, [nullTarget, ...cohort]);
    expect(axes.find((a) => a.key === 'headshot')!.percentile).toBe(0);
  });
});

describe('MIN_GAMES_FOR_HEXAGON', () => {
  it('4경기다', () => {
    expect(MIN_GAMES_FOR_HEXAGON).toBe(4);
  });
});
