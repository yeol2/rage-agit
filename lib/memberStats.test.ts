import { describe, expect, it } from 'vitest';
import {
  ALL_TIERS,
  MEMBER_STAT_TIER_GROUPS,
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  cleanDisplayName,
  percentile,
  stripTrailingKoreanTag,
  tierColorRamp,
  tierGroupFor,
  tierNameplateSelectedStyle,
  tierNameplateStyle,
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

  it('코호트 평균도 같은 코호트 안에서 백분위로 낸다', () => {
    // damage=[200,100] 평균 150 → 150 이하인 값은 100 하나뿐이니 2명 중 1명 = 50%.
    // rank 는 낮을수록 좋으므로 방향이 뒤집힌다: [5,10] 평균 7.5 → 7.5 이상인
    // 값은 10 하나뿐 = 50%. 우연히 다 50%가 나오는 대칭 표본으로 골랐다.
    const axes = buildHexagonAxes(target, cohort);
    expect(axes.every((a) => a.averagePercentile === 50)).toBe(true);
  });

  it('null 인 headshotRatio 는 평균 계산에서도 빠진다', () => {
    const withNull = [...cohort, row({ memberId: 'm-3', headshotRatio: null })];
    const axes = buildHexagonAxes(target, withNull);
    // withNull 이 추가돼도 헤드샷 평균은 [0.3, 0.1] 기준 그대로라 50%.
    expect(axes.find((a) => a.key === 'headshot')!.averagePercentile).toBe(50);
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
    // 괄호 뒤에 붙은 한글 별칭처럼 괄호·이모지·슬래시가 아닌 장식은 건드리지 않는다.
    expect(cleanDisplayName('Ez_D (98)은킹')).toBe('Ez_D 은킹');
  });

  it('꾸밈이 없으면 그대로 둔다', () => {
    expect(cleanDisplayName('Ez_E-')).toBe('Ez_E-');
  });

  it('슬래시 뒤 부계정 표기는 뗀다', () => {
    expect(cleanDisplayName('Ez_F/Ez_G')).toBe('Ez_F');
  });
});

describe('stripTrailingKoreanTag', () => {
  it('공백 뒤에 붙은 한글 태그를 뗀다', () => {
    expect(stripTrailingKoreanTag('Ez_Gimli 김리')).toBe('Ez_Gimli');
  });

  it('공백 없이 바로 붙은 한글도 뗀다', () => {
    expect(stripTrailingKoreanTag('Ez_Jhoney주헌')).toBe('Ez_Jhoney');
  });

  it('한글이 없으면 그대로 둔다', () => {
    expect(stripTrailingKoreanTag('Ez_Code')).toBe('Ez_Code');
  });

  it('통째로 한글이면 자르지 않는다', () => {
    expect(stripTrailingKoreanTag('은킹')).toBe('은킹');
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

describe('tierNameplateStyle', () => {
  it('정수 티어는 테두리가 있다', () => {
    expect(tierNameplateStyle(2).borderColor).toBe('#db8a42ff');
  });

  it('반티어는 무채색 테두리를 써서 정수 티어(색 있는 테두리)와 구분한다', () => {
    expect(tierNameplateStyle(2.5).borderColor).toBe('rgba(255, 255, 255, 0.16)');
  });

  it('배경색(그라데이션)은 정수·반티어가 같은 묶음이면 동일하다', () => {
    expect(tierNameplateStyle(2).background).toBe(tierNameplateStyle(2.5).background);
  });

  it('정수 티어끼리는 같은 스타일을 낸다', () => {
    expect(tierNameplateStyle(3)).toEqual(tierNameplateStyle(3));
  });
});

describe('tierNameplateSelectedStyle', () => {
  it('기본 네임플레이트보다 진한 배색을 낸다', () => {
    const base = tierNameplateStyle(2);
    const selected = tierNameplateSelectedStyle(2);
    expect(selected).not.toEqual(base);
    // 배경 불투명도(뒤 2자리 hex)는 selected 가 base 보다 더 진해야 한다.
    expect(selected.background).not.toBe(base.background);
    expect(selected.background).toContain('#db8a42b3');
  });
});
