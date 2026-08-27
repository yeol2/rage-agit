import { describe, expect, it } from 'vitest';
import { attachPreviousRanks, computeRankChange, computeSnapshotRows, snapshotKey } from './rankingSnapshot';
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
    winCount: 0,
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

describe('attachPreviousRanks', () => {
  // 0031: 캡처 직후 rank_position 이 "지금" 등수로 덮어써지면 화면이 그걸
  // 실시간 등수와 비교해도 항상 같아져 변동이 안 보인다 — previousRankPosition
  // 이 그 앞 캡처(지난 세션) 값을 대신 들고 있어야 비교 기준이 산다.
  it('덮어쓰기 전 값을 previousRankPosition 으로 옮겨 붙인다', () => {
    const newRows = [{ window: 'recent16' as const, groupId: 'all', memberId: 'a', rankPosition: 1 }];
    const previous = new Map([[snapshotKey(newRows[0]), 3]]);

    expect(attachPreviousRanks(newRows, previous)).toEqual([
      { window: 'recent16', groupId: 'all', memberId: 'a', rankPosition: 1, previousRankPosition: 3 },
    ]);
  });

  it('그 조합이 전에 없었으면(첫 캡처) previousRankPosition 이 null이다', () => {
    const newRows = [{ window: 'alltime' as const, groupId: '0-1.5', memberId: 'b', rankPosition: 5 }];

    expect(attachPreviousRanks(newRows, new Map())).toEqual([
      { window: 'alltime', groupId: '0-1.5', memberId: 'b', rankPosition: 5, previousRankPosition: null },
    ]);
  });

  it('window/groupId가 다르면 같은 memberId라도 서로 안 섞인다', () => {
    const newRows = [
      { window: 'recent16' as const, groupId: 'all', memberId: 'a', rankPosition: 2 },
      { window: 'alltime' as const, groupId: 'all', memberId: 'a', rankPosition: 4 },
    ];
    const previous = new Map([
      [snapshotKey(newRows[0]), 9],
      [snapshotKey(newRows[1]), 7],
    ]);

    expect(attachPreviousRanks(newRows, previous).map((r) => r.previousRankPosition)).toEqual([9, 7]);
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
