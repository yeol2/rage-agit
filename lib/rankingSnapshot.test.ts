import { describe, expect, it } from 'vitest';
import { computeRankChange, computeSnapshotRows } from './rankingSnapshot';
import type { RankingStatsRow } from './rankingStats';

function row(overrides: Partial<RankingStatsRow> = {}): RankingStatsRow {
  return {
    memberId: 'm-1',
    discordNickname: 'Member1',
    tier: 0,
    totalGameCount: 20,
    windowGameCount: 20,
    avgKills: 2,
    avgPlacementPoints: 4,
    avgRank: 5,
    lastPlayedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeSnapshotRows', () => {
  it('전체(all) 그룹과 그 사람의 티어 그룹 양쪽에 순위를 낸다', () => {
    const rows = [
      row({ memberId: 'a', tier: 0, avgPlacementPoints: 8 }),
      row({ memberId: 'b', tier: 0, avgPlacementPoints: 4 }),
      row({ memberId: 'c', tier: 2, avgPlacementPoints: 100 }),
    ];
    const result = computeSnapshotRows(rows, rows);

    const recentAll = result.filter((r) => r.window === 'recent16' && r.groupId === 'all');
    expect(recentAll.find((r) => r.memberId === 'a')?.rankPosition).toBe(1);

    const recentTier0 = result.filter((r) => r.window === 'recent16' && r.groupId === '0-1.5');
    expect(recentTier0.map((r) => r.memberId).sort()).toEqual(['a', 'b']);

    const recentTier2 = result.filter((r) => r.window === 'recent16' && r.groupId === '2-2.5');
    expect(recentTier2.map((r) => r.memberId)).toEqual(['c']);
  });

  it('자격 미달(경기수 부족)인 사람은 어느 그룹에도 안 낀다', () => {
    const rows = [row({ memberId: 'a', totalGameCount: 3 })];
    expect(computeSnapshotRows(rows, rows)).toEqual([]);
  });

  it('recent16과 alltime을 따로 계산한다', () => {
    const recentRows = [row({ memberId: 'a', avgPlacementPoints: 10 })];
    const alltimeRows = [row({ memberId: 'a', avgPlacementPoints: 2 })];
    const result = computeSnapshotRows(recentRows, alltimeRows);
    expect(result.filter((r) => r.window === 'alltime').map((r) => r.memberId)).toContain('a');
    expect(result.filter((r) => r.window === 'recent16').map((r) => r.memberId)).toContain('a');
  });
});

describe('computeRankChange', () => {
  it('이전 스냅샷에 없으면 신규다', () => {
    expect(computeRankChange(3, undefined)).toEqual({ type: 'new' });
  });

  it('순위 숫자가 작아지면(상승) up과 상승폭을 낸다', () => {
    expect(computeRankChange(2, 5)).toEqual({ type: 'up', delta: 3 });
  });

  it('순위 숫자가 커지면(하락) down과 하락폭을 낸다', () => {
    expect(computeRankChange(7, 5)).toEqual({ type: 'down', delta: 2 });
  });

  it('순위가 같으면 아무것도 안 낸다', () => {
    expect(computeRankChange(4, 4)).toBeNull();
  });
});
