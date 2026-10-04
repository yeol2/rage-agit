import { beforeEach, describe, expect, it, vi } from 'vitest';

// 지표는 "우승 확정"을 누른 일반 내전만 센다(0047). 그래서 등수 변동 스냅샷도
// 폴링이 아니라 확정 순간에 찍는다 — 저티어 내전은 집계가 안 바뀌므로 찍지 않는다.

const buildRoundSheet = vi.fn();
const captureRankingSnapshotForRoster = vi.fn();
const revalidatePath = vi.fn();
const inserted: unknown[][] = [];

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock('@/lib/revalidateRecordPages', () => ({ revalidateRecordPages: vi.fn() }));
vi.mock('@/lib/roundSheetData', () => ({
  buildRoundSheet: (...args: unknown[]) => buildRoundSheet(...args),
}));
vi.mock('@/lib/rankingSnapshot', () => ({
  captureRankingSnapshotForRoster: (...args: unknown[]) => captureRankingSnapshotForRoster(...args),
}));
vi.mock('@/lib/supabaseServer', () => ({
  getSupabaseServer: () => {
    const chain: Record<string, unknown> = {
      from: () => chain,
      delete: () => chain,
      eq: () => chain,
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
      insert: (rows: unknown[]) => {
        inserted.push(rows);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  },
}));

// eslint-disable-next-line import/first
import { POST } from './route';

function confirm(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/scrim-roster/round-sheet/confirm-win', {
      method: 'POST',
      body: JSON.stringify({ scrimDate: '2026-10-04', rosterId: 'roster-1', ...body }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  inserted.length = 0;
  captureRankingSnapshotForRoster.mockResolvedValue({ captured: true });
  buildRoundSheet.mockResolvedValue({
    scrimDate: '2026-10-04',
    roundCount: 4,
    teams: [
      {
        teamNumber: 1,
        standing: 1,
        memberIds: ['m1', 'm2'],
        players: ['Ez_A', 'Ez_B'],
        totalPlacementPoints: 10,
        totalKills: 10,
        totalScore: 20,
      },
    ],
  });
});

describe('우승 확정 — 리더보드 반영', () => {
  it('일반 내전을 확정하면 등수 스냅샷을 찍고 리더보드를 갱신한다', async () => {
    const res = await confirm({ lowTier: false });

    expect(res.status).toBe(200);
    expect(captureRankingSnapshotForRoster).toHaveBeenCalledWith(expect.anything(), 'roster-1');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('저티어 내전은 저티어로 저장하고 스냅샷을 찍지 않는다', async () => {
    const res = await confirm({ lowTier: true });

    expect(res.status).toBe(200);
    expect(captureRankingSnapshotForRoster).not.toHaveBeenCalled();
    expect((inserted[0] as Array<{ low_tier: boolean }>).every((row) => row.low_tier)).toBe(true);
  });
});
