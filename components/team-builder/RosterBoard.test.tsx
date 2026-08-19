import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterBoard } from './RosterBoard';
import type { Roster, RosterEntry } from '@/lib/scrimRoster';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeEntry(overrides: Partial<RosterEntry>): RosterEntry {
  return {
    id: 'e1',
    discordNickname: 'Ez_Test',
    memberId: null,
    tier: 0,
    tierSlot: 1,
    matched: true,
    vipRank: null,
    teamNumber: null,
    ...overrides,
  };
}

function makeRoster(entries: RosterEntry[]): Roster {
  return { id: 'roster-1', fetchedAt: new Date().toISOString(), entries };
}

describe('RosterBoard - 팀 구성', () => {
  it('1~4티어가 다 안 찼으면 팀 구성 버튼이 비활성화된다', () => {
    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1 })]);
    render(<RosterBoard roster={roster} />);
    expect(screen.getByRole('button', { name: '팀 구성' })).toBeDisabled();
  });

  it('1~4티어가 다 차면 버튼 클릭 시 API를 호출하고 02 표를 채운다', async () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha' }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2, discordNickname: 'Ez_Bravo' }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3, discordNickname: 'Ez_Charlie' }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4, discordNickname: 'Ez_Delta' }),
    ];
    const roster = makeRoster(entries);
    const assigned = entries.map((entry) => ({ ...entry, teamNumber: 1 }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: assigned }) }),
    );

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    await waitFor(() => expect(screen.getByText('02')).toBeInTheDocument());
    // Ez_Delta는 01 티어 칸에도 그대로 남아 있고 02 표에도 새로 나타나므로 두 번 나온다.
    expect(screen.getAllByText('Ez_Delta').length).toBe(2);
    expect(fetch).toHaveBeenCalledWith(
      '/api/scrim-roster/team-assignments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });

  it('API가 실패를 응답하면 에러 메시지를 보여주고 02 표는 열지 않는다', async () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0 }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2 }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3 }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4 }),
    ];
    const roster = makeRoster(entries);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '팀 구성에 실패했습니다.' }) }),
    );

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    expect(await screen.findByText('팀 구성에 실패했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('02')).not.toBeInTheDocument();
  });
});
