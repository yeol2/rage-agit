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
  // 클랜 전체 표본. 위아래 둘씩이라 축마다 평균과 표준편차가 딱 떨어진다
  // (딜량 평균 200 편차 100, 순위 평균 8 편차 4 …).
  const strong = { avgDamage: 300, avgKills: 3, rankStddev: 2, avgSurvival: 1500, avgAssists: 2, avgRank: 4 };
  const weak = { avgDamage: 100, avgKills: 1, rankStddev: 6, avgSurvival: 900, avgAssists: 0, avgRank: 12 };
  const clan = [
    row({ memberId: 'c-1', ...strong }),
    row({ memberId: 'c-2', ...strong }),
    row({ memberId: 'c-3', ...weak }),
    row({ memberId: 'c-4', ...weak }),
  ];
  const middle = row({ avgDamage: 200, avgKills: 2, rankStddev: 4, avgSurvival: 1200, avgAssists: 1, avgRank: 8 });

  it('6축을 정해진 순서와 라벨로 낸다', () => {
    const axes = buildHexagonAxes(middle, clan, clan);
    expect(axes.map((a) => a.key)).toEqual(['damage', 'kills', 'stability', 'survival', 'assists', 'rank']);
    expect(axes.map((a) => a.label)).toEqual(['딜량', '킬', '안정성', '생존', '어시', '순위']);
  });

  it('클랜 평균과 같은 값이면 한가운데다', () => {
    const axes = buildHexagonAxes(middle, clan, clan);
    expect(axes.every((a) => a.percent === 50)).toBe(true);
  });

  // 눈금 끝이 2 표준편차라, 1 표준편차 위인 사람은 딱 4분의 3 지점에 온다.
  it('눈금은 클랜 평균 ±2 표준편차다', () => {
    const axes = buildHexagonAxes(clan[0], clan, clan);
    expect(axes.find((a) => a.key === 'damage')!.percent).toBe(75);
    expect(axes.find((a) => a.key === 'rank')!.percent).toBe(75);
  });

  it('안정성과 순위는 값이 작을수록 바깥이다', () => {
    const axes = buildHexagonAxes(clan[2], clan, clan);
    expect(axes.find((a) => a.key === 'stability')!.percent).toBe(25);
    expect(axes.find((a) => a.key === 'rank')!.percent).toBe(25);
  });

  // 이 그림의 핵심 — 자는 모두에게 같고, 점선만 티어 그룹에 따라 커지고 작아진다.
  it('눈금은 클랜 전체 기준이고, 점선만 티어 그룹 평균 자리로 간다', () => {
    const inStrong = buildHexagonAxes(middle, clan, [clan[0], clan[1]]);
    const inWeak = buildHexagonAxes(middle, clan, [clan[2], clan[3]]);

    // 같은 사람이므로 실선 자리는 그룹이 달라도 그대로다.
    expect(inStrong.map((a) => a.percent)).toEqual(inWeak.map((a) => a.percent));
    // 잘하는 그룹의 점선이 모든 축에서 더 바깥에 있다.
    for (let i = 0; i < inStrong.length; i += 1) {
      expect(inStrong[i].averagePercent).toBeGreaterThan(inWeak[i].averagePercent);
    }
  });

  it('툴팁에 쓸 내 값과 그룹 평균값을 단위까지 붙여 낸다', () => {
    const axes = buildHexagonAxes(clan[0], clan, [clan[0], clan[2]]);
    const damage = axes.find((a) => a.key === 'damage')!;
    expect(damage.valueText).toBe('300딜');
    expect(damage.averageText).toBe('200딜');
    // 생존은 초로 들어와 분으로 나간다.
    expect(axes.find((a) => a.key === 'survival')!.valueText).toBe('25.0분');
    expect(axes.find((a) => a.key === 'rank')!.averageText).toBe('8.0등');
  });

  it('rankStddev 가 null 인 사람은 안정성 계산에서 빠진다', () => {
    const withNull = [...clan, row({ memberId: 'c-5', rankStddev: null })];
    const axes = buildHexagonAxes(middle, withNull, withNull);
    // null 이 낀 것과 무관하게 [2, 2, 6, 6] 기준 그대로다.
    expect(axes.find((a) => a.key === 'stability')!.averageText).toBe('±4.00등');
  });

  it('본인의 rankStddev 가 null 이면 도형을 그룹 평균 자리에 놓고 기록 없음이라 적는다', () => {
    const nullTarget = row({ rankStddev: null });
    const axes = buildHexagonAxes(nullTarget, clan, clan);
    const stability = axes.find((a) => a.key === 'stability')!;
    expect(stability.percent).toBe(stability.averagePercent);
    expect(stability.valueText).toBe('기록 없음');
  });
});
