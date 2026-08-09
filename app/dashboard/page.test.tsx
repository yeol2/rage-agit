import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// 페이지 구성만 확인하는 테스트라 네트워크를 타면 안 된다.
// 내전 목록의 동작 자체는 RecentScrimsList / ScrimSessionRow 테스트가 덮는다.
//
// 세션 데이터를 팩토리 안에 두는 이유: vi.mock 은 파일 맨 위로 끌어올려지므로
// 바깥에 선언한 변수를 참조하면 초기화 전에 접근하게 된다.
vi.mock('@/lib/scrimData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/scrimData')>()),
  fetchScrimSessions: vi.fn().mockResolvedValue([
    {
      id: 's1',
      scrimDate: '2026-08-09',
      title: '2026-08-09 (일) 내전',
      sessionNumber: null,
      replayUrl: null,
      matchCount: 4,
      participantCount: 64,
    },
    {
      id: 's2',
      scrimDate: '2026-08-02',
      title: '2026-08-02 (일) 내전',
      sessionNumber: null,
      replayUrl: null,
      matchCount: 4,
      participantCount: 64,
    },
  ]),
}));

// eslint-disable-next-line import/first
import DashboardPage from './page';

afterEach(cleanup);

describe('DashboardPage', () => {
  it('네비·티어 랭킹·최근 내전·푸터를 함께 그린다', async () => {
    render(await DashboardPage());
    expect(screen.getByRole('link', { name: 'DASHBOARD' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '티어 랭킹' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '최근 내전' })).toBeInTheDocument();
    expect(screen.getByText('2026-08-09 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText(/VERSION/)).toBeInTheDocument();
  });
});
