import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/supabaseServer', () => ({ getSupabaseServer: () => ({}) }));
vi.mock('@/lib/rankingSnapshot', () => ({
  captureRankingSnapshotForRoster: vi.fn().mockResolvedValue({ captured: true }),
}));

describe('POST /api/ranking-snapshots/capture', () => {
  it('rosterId가 없으면 400을 낸다', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(400);
  });

  it('rosterId가 있으면 캡처 함수를 호출하고 결과를 그대로 낸다', async () => {
    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ rosterId: 'r1' }) }),
    );
    const body = await response.json();
    expect(body).toEqual({ captured: true });
  });
});
