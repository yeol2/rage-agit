import { describe, expect, it } from 'vitest';
import {
  ALL_TIERS,
  MEMBER_STAT_TIER_GROUPS,
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  cleanDisplayName,
  percentile,
  tierColorRamp,
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
    expect(axes.map((a) => a.label)).toEqual(['딜량', '킬', '헤드샷', '생존', '어시', '순위']);
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

describe('ALL_TIERS', () => {
  it('0티어부터 5티어까지 10개 값을 오름차순으로 낸다', () => {
    expect(ALL_TIERS).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
});

describe('cleanDisplayName', () => {
  it('괄호로 묶인 태그를 뗀다', () => {
    expect(cleanDisplayName('Ez_A(98)')).toBe('Ez_A');
  });

  it('이모지를 뗀다', () => {
    expect(cleanDisplayName('Ez_B👀')).toBe('Ez_B');
  });

  it('괄호와 이모지가 같이 있어도 다 뗀다', () => {
    expect(cleanDisplayName('Ez_C(89)👀')).toBe('Ez_C');
  });

  it('괄호 앞뒤 공백은 정리하되 괄호 뒤에 남은 글자는 그대로 둔다', () => {
    // '()나 이모티콘'만 떼라는 요청이라, 슬래시 부계정 표기나 뒤에 붙은
    // 한글 별칭처럼 괄호·이모지가 아닌 장식은 건드리지 않는다.
    expect(cleanDisplayName('Ez_D (98)은킹')).toBe('Ez_D 은킹');
  });

  it('꾸밈이 없으면 그대로 둔다', () => {
    expect(cleanDisplayName('Ez_E-')).toBe('Ez_E-');
  });

  it('괄호가 없으면 손대지 않는다(슬래시 부계정 표기 포함)', () => {
    expect(cleanDisplayName('Ez_F/Ez_G')).toBe('Ez_F/Ez_G');
  });
});

describe('tierColorRamp', () => {
  it('0티어는 단독 배색을 쓴다', () => {
    expect(tierColorRamp(0)).toEqual({ from: '#9e6bff', to: '#9fc1ff' });
  });

  it('1티어와 1.5티어는 같은 배색을 공유한다', () => {
    expect(tierColorRamp(1)).toEqual(tierColorRamp(1.5));
    expect(tierColorRamp(1)).toEqual({ from: '#4cadd0', to: '#b2f9ff' });
  });

  it('2~2.5, 3~3.5, 4~4.5 도 각각 짝을 이룬다', () => {
    expect(tierColorRamp(2)).toEqual(tierColorRamp(2.5));
    expect(tierColorRamp(3)).toEqual(tierColorRamp(3.5));
    expect(tierColorRamp(4)).toEqual(tierColorRamp(4.5));
  });

  it('5티어는 단독 배색을 쓴다', () => {
    expect(tierColorRamp(5)).toEqual({ from: '#f5dc1f', to: '#f0e9ca' });
  });

  it('배색표에 없는 티어면 에러를 던진다', () => {
    expect(() => tierColorRamp(9)).toThrow();
  });
});
