import { describe, it, expect } from 'vitest';
import {
  TIER_GROUPS,
  SCRIM_SESSIONS,
  getRecentScrims,
  formatScrimDate,
  type ScrimSession,
} from './dashboardData';

describe('TIER_GROUPS', () => {
  it('defines the five tier group tabs in order', () => {
    expect(TIER_GROUPS.map((g) => g.id)).toEqual(['all', '0-1.5', '2-2.5', '3-3.5', '4-4.5']);
    expect(TIER_GROUPS.map((g) => g.label)).toEqual([
      '전체',
      '0~1.5티어',
      '2~2.5티어',
      '3~3.5티어',
      '4~4.5티어',
    ]);
    expect(TIER_GROUPS[0].tiers).toBeNull();
    expect(TIER_GROUPS[1].tiers).toEqual([0, 1, 1.5]);
    expect(TIER_GROUPS[2].tiers).toEqual([2, 2.5]);
    expect(TIER_GROUPS[3].tiers).toEqual([3, 3.5]);
    expect(TIER_GROUPS[4].tiers).toEqual([4, 4.5]);
  });
});

describe('getRecentScrims', () => {
  const outOfOrder: ScrimSession[] = [
    { id: 's1', title: 'A', date: '2026-07-01', participantCount: 64, matchCount: 4, replayUrl: null },
    { id: 's2', title: 'B', date: '2026-08-01', participantCount: 64, matchCount: 4, replayUrl: null },
    { id: 's3', title: 'C', date: '2026-06-01', participantCount: 64, matchCount: 4, replayUrl: null },
    { id: 's4', title: 'D', date: '2026-07-15', participantCount: 64, matchCount: 4, replayUrl: null },
  ];

  it('sorts sessions by date descending, most recent first', () => {
    const result = getRecentScrims(outOfOrder);
    expect(result.map((s) => s.id)).toEqual(['s2', 's4', 's1', 's3']);
  });

  it('respects the limit argument', () => {
    const result = getRecentScrims(outOfOrder, 2);
    expect(result.map((s) => s.id)).toEqual(['s2', 's4']);
  });

  it('defaults to a limit of 10', () => {
    const many: ScrimSession[] = Array.from({ length: 15 }, (_, i) => ({
      id: `x${i}`,
      title: `Scrim ${i}`,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      participantCount: 64,
      matchCount: 4,
      replayUrl: null,
    }));
    expect(getRecentScrims(many)).toHaveLength(10);
  });

  it('does not mutate the input array', () => {
    const copy = [...outOfOrder];
    getRecentScrims(outOfOrder);
    expect(outOfOrder).toEqual(copy);
  });
});

describe('formatScrimDate', () => {
  it('labels a known Sunday correctly', () => {
    expect(formatScrimDate('2026-08-02')).toBe('2026-08-02 (일)');
  });

  it('labels a known Monday correctly', () => {
    expect(formatScrimDate('2026-08-03')).toBe('2026-08-03 (월)');
  });

  it('labels a known Saturday correctly', () => {
    expect(formatScrimDate('2026-08-08')).toBe('2026-08-08 (토)');
  });
});

describe('mock data', () => {
  it('ships ten scrim sessions, most recent first', () => {
    expect(SCRIM_SESSIONS).toHaveLength(10);
    expect(SCRIM_SESSIONS[0].date).toBe('2026-08-02');
    expect(SCRIM_SESSIONS[9].date).toBe('2026-05-31');
  });
});
