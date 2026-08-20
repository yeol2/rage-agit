import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundSheet } from './RoundSheet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockSheetResponse(roundCount: number) {
  return {
    roundCount,
    teams: [
      {
        teamNumber: 1,
        place: 1,
        players: ['Ez_Alpha', 'Ez_Bravo', 'Ez_Charlie', 'Ez_Delta'],
        totalKills: 10,
        totalScore: 20,
        rounds: Array.from({ length: roundCount }, (_, i) => ({
          roundNo: i + 1,
          kills: 5,
          teamRank: 1,
          cumulativeTotal: (i + 1) * 10,
        })),
      },
    ],
  };
}

describe('RoundSheet', () => {
  it('마운트 시 round-sheet 를 불러와 라운드 수만큼만 ROUND 칼럼을 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockSheetResponse(2) }),
    );

    render(<RoundSheet rosterId="roster-1" />);

    await screen.findByText('ROUND 1');
    expect(screen.getByText('ROUND 2')).toBeInTheDocument();
    expect(screen.queryByText('ROUND 3')).not.toBeInTheDocument();
    expect(screen.getByText(/Ez_Alpha \/ Ez_Bravo \/ Ez_Charlie \/ Ez_Delta/)).toBeInTheDocument();
  });

  it('"폴링" 버튼을 눌러 새 경기를 찾으면 시트를 다시 불러온다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ found: true }) };
      return { ok: true, json: async () => mockSheetResponse(1) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await screen.findByText('ROUND 1');

    await userEvent.click(screen.getByRole('button', { name: '폴링' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/round-sheet/poll',
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/round-sheet?rosterId=roster-1'),
    );
  });

  it('폴링했는데 새 경기가 없으면 안내 메시지를 보여준다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ found: false }) };
      return { ok: true, json: async () => mockSheetResponse(0) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: '폴링' }));

    expect(await screen.findByText('아직 새 경기가 없습니다.')).toBeInTheDocument();
  });
});
