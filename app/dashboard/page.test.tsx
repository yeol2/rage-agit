import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('@/lib/rankingStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rankingStats')>()),
  fetchRankingStats: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/rankingSnapshot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rankingSnapshot')>()),
  fetchRankingSnapshots: vi.fn().mockResolvedValue([]),
}));

// eslint-disable-next-line import/first
import DashboardPage from './page';

afterEach(cleanup);

describe('DashboardPage', () => {
  it('네비·리더보드·푸터를 함께 그린다', async () => {
    render(await DashboardPage());
    expect(within(screen.getByRole('banner')).getByRole('link', { name: '리더보드' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '리더보드', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '리더보드', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/VERSION/)).toBeInTheDocument();
  });
});
