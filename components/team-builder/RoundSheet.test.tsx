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
        standing: 1,
        players: ['Ez_Alpha', 'Ez_Bravo', 'Ez_Charlie', 'Ez_Delta'],
        totalKills: 10,
        totalPlacementPoints: 10,
        totalScore: 20,
        rounds: Array.from({ length: roundCount }, (_, i) => ({
          roundNo: i + 1,
          kills: 5,
          teamRank: 1,
          rankScore: 10,
          roundTotal: 15,
        })),
      },
    ],
  };
}

describe('RoundSheet', () => {
  it('마운트 시 round-sheet 를 불러와 ROUND 1~4 껍데기를 항상 다 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockSheetResponse(2) }),
    );

    render(<RoundSheet rosterId="roster-1" />);

    await screen.findByText('ROUND 1');
    expect(screen.getByText('ROUND 2')).toBeInTheDocument();
    // 아직 안 온 라운드(3~4)도 껍데기는 그려지고, 값은 "-"로 비어 있다.
    expect(screen.getByText('ROUND 3')).toBeInTheDocument();
    expect(screen.getByText('ROUND 4')).toBeInTheDocument();
    // "Ez_" 접두사는 빼고 보여준다.
    expect(screen.getByText('Alpha / Bravo / Charlie / Delta')).toBeInTheDocument();
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
      expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/round-sheet', { cache: 'no-store' }),
    );
  });

  it('폴링했는데 새 경기가 없으면 시도 횟수를 보여주며 계속 재시도한다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ found: false }) };
      return { ok: true, json: async () => mockSheetResponse(0) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: '폴링' }));

    // 손으로 다시 누를 필요 없이 알아서 계속 두드린다 — 첫 시도는 즉시 끝난다.
    expect(await screen.findByRole('button', { name: '폴링 중… (1번째 시도)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '중단' })).toBeInTheDocument();
  });

  it('"중단"을 누르면 다음 시도까지 기다리지 않고 바로 멈춘다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ found: false }) };
      return { ok: true, json: async () => mockSheetResponse(0) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: '폴링' }));
    await screen.findByRole('button', { name: '중단' });
    await userEvent.click(screen.getByRole('button', { name: '중단' }));

    expect(await screen.findByText('중단했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '폴링' })).toBeInTheDocument();
  });
});

describe('RoundSheet — 우승 확정', () => {
  it('4경기가 다 안 들어왔으면 버튼이 잠겨 있다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockSheetResponse(3) }),
    );

    render(<RoundSheet rosterId="roster-1" />);

    const button = await screen.findByRole('button', { name: '우승 확정' });
    expect(button).toBeDisabled();
  });

  it('4경기가 다 들어오면 눌러서 확정하고, 우승팀과 저장된 등수 규모를 알려준다', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('confirm-win')) {
        return {
          ok: true,
          json: async () => ({
            scrimDate: '2026-08-23',
            teamNumber: 1,
            totalScore: 20,
            players: ['Ez_Alpha', 'Ez_Bravo', 'Ez_Charlie', 'Ez_Delta'],
            savedTeams: 16,
            savedMembers: 63,
          }),
        };
      }
      return { ok: true, json: async () => mockSheetResponse(4) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await userEvent.click(await screen.findByRole('button', { name: '우승 확정' }));

    // 저장되는 건 우승팀만이 아니라 1~16위 전부다(0028) — 몇 팀·몇 명이 들어갔는지가
    // 같이 보여야 매칭이 덜 된 채로 확정한 걸 알아챌 수 있다.
    expect(
      await screen.findByText(
        '종합우승 확정 — Alpha / Bravo / Charlie / Delta (20점) · 종합등수 16팀 63명 저장',
      ),
    ).toBeInTheDocument();
  });

  it('서버가 거절하면 그 이유를 그대로 보여준다', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('confirm-win')) {
        return { ok: false, json: async () => ({ error: '아직 내전 세션이 없습니다.' }) };
      }
      return { ok: true, json: async () => mockSheetResponse(4) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RoundSheet rosterId="roster-1" />);
    await userEvent.click(await screen.findByRole('button', { name: '우승 확정' }));

    expect(await screen.findByText('아직 내전 세션이 없습니다.')).toBeInTheDocument();
  });
});
