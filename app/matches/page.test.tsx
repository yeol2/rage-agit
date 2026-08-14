import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

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
import MatchesPage from './page';

afterEach(cleanup);

describe('MatchesPage', () => {
  it('네비·최근 내전·푸터를 함께 그린다', async () => {
    render(await MatchesPage());
    expect(within(screen.getByRole('banner')).getByRole('link', { name: '매치 기록' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '최근 내전' })).toBeInTheDocument();
    expect(screen.getByText('2026-08-09 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText(/VERSION/)).toBeInTheDocument();
  });
});
