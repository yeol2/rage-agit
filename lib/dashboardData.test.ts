import { describe, it, expect } from 'vitest';
import {
  TIER_GROUPS,
  MEMBERS,
  SCRIM_SESSIONS,
  getTopMembers,
  formatScrimDate,
  type Member,
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

describe('getTopMembers', () => {
  const fixture: Member[] = [
    { id: 'a', ign: 'Alpha', tier: 2, score: 50 },
    { id: 'b', ign: 'Bravo', tier: 2.5, score: 80 },
    { id: 'c', ign: 'Charlie', tier: 1, score: 90 },
    { id: 'd', ign: 'Delta', tier: 2, score: 70 },
  ];

  it('filters by the group tiers and sorts by score descending', () => {
    const group = { id: 'test', label: 'Test', tiers: [2, 2.5] };
    const top = getTopMembers(fixture, group);
    expect(top.map((m) => m.ign)).toEqual(['Bravo', 'Delta', 'Alpha']);
  });

  it('ignores the tier filter when tiers is null (전체)', () => {
    const group = { id: 'all', label: '전체', tiers: null };
    const top = getTopMembers(fixture, group);
    expect(top.map((m) => m.ign)).toEqual(['Charlie', 'Bravo', 'Delta']);
  });

  it('returns fewer than the limit when the group has too few members', () => {
    const group = { id: 'empty', label: 'Empty', tiers: [9] };
    const top = getTopMembers(fixture, group);
    expect(top).toHaveLength(0);
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
  it('leaves the 4~4.5 tier group with only one member, to exercise the empty-podium-slot case', () => {
    const group = TIER_GROUPS.find((g) => g.id === '4-4.5')!;
    const top = getTopMembers(MEMBERS, group);
    expect(top).toHaveLength(1);
    expect(top[0].ign).toBe('레이지에이스');
  });

  it('ships ten scrim sessions, most recent first', () => {
    expect(SCRIM_SESSIONS).toHaveLength(10);
    expect(SCRIM_SESSIONS[0].date).toBe('2026-08-02');
    expect(SCRIM_SESSIONS[9].date).toBe('2026-05-31');
  });
});
