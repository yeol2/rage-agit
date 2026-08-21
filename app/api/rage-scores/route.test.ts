import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/rankingStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rankingStats')>();
  return {
    ...actual,
    fetchRankingStats: vi.fn().mockResolvedValue([
      {
        memberId: 'a',
        discordNickname: 'A',
        tier: 0,
        totalGameCount: 20,
        windowGameCount: 20,
        avgKills: 3,
        avgPlacementPoints: 8,
        avgRank: 2,
        lastPlayedAt: new Date().toISOString(),
      },
    ]),
  };
});

describe('GET /api/rage-scores', () => {
  it('memberId를 키로 하는 점수 맵을 낸다', async () => {
    const response = await GET(new Request('http://localhost/api/rage-scores?window=recent16'));
    const body = await response.json();
    expect(typeof body.scores.a).toBe('number');
  });
});
