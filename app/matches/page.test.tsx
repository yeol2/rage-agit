import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// 최근 내전 시트 — 03 시트와 같은 계산을 서버에서 부른다.
const buildRoundSheet = vi.fn();
const latestScrimDate = vi.fn();
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseServer: () => ({}) }));
vi.mock('@/lib/roundSheetData', () => ({
  buildRoundSheet: (...a: unknown[]) => buildRoundSheet(...a),
  latestScrimDate: (...a: unknown[]) => latestScrimDate(...a),
}));

// eslint-disable-next-line import/first
import MatchesPage from './page';

beforeEach(() => {
  latestScrimDate.mockResolvedValue('2026-11-12');
  buildRoundSheet.mockResolvedValue({
    scrimDate: '2026-11-12',
    roundCount: 4,
    unstableTeamPlayers: [],
    teams: [
      {
        teamNumber: 9,
        standing: 1,
        players: ['Ez_sejin', 'Ez_Cold-'],
        memberIds: ['m1', 'm2'],
        totalKills: 37,
        totalPlacementPoints: 16,
        totalScore: 53,
        rounds: [],
      },
    ],
  });
});

afterEach(cleanup);

describe('MatchesPage', () => {
  it('네비·내전 기록·푸터를 함께 그린다', async () => {
    render(await MatchesPage());
    expect(within(screen.getByRole('banner')).getByRole('link', { name: '내전 기록' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '내전 기록' })).toBeInTheDocument();
    expect(screen.getByText('2026-08-09 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText(/VERSION/)).toBeInTheDocument();
  });

  it('제목 아래에 최근 내전 시트를 버튼 없이 표만 띄운다', async () => {
    render(await MatchesPage());
    const sheet = screen.getByRole('table', { name: '내전 시트' });
    expect(within(sheet).getByText('sejin / Cold-')).toBeInTheDocument();
    expect(screen.getByText('2026-11-12 (목) 내전')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /폴링|우승 확정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: '저티어 내전' })).not.toBeInTheDocument();
  });

  it('시트를 못 불러와도 목록은 그대로 보인다', async () => {
    latestScrimDate.mockRejectedValue(new Error('db down'));
    render(await MatchesPage());
    expect(screen.queryByRole('table', { name: '내전 시트' })).not.toBeInTheDocument();
    expect(screen.getByText('2026-08-09 (일) 내전')).toBeInTheDocument();
  });
});
