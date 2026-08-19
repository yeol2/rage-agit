import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

describe('RosterBoard - 02 표 스왑 / VIP 정렬', () => {
  function makeFullEntries(): RosterEntry[] {
    return [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha', teamNumber: 1 }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2, discordNickname: 'Ez_Bravo', teamNumber: 1 }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3, discordNickname: 'Ez_Charlie', teamNumber: 1 }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4, discordNickname: 'Ez_Delta', teamNumber: 1 }),
      makeEntry({ id: 'e', tierSlot: 1, tier: 1, discordNickname: 'Ez_Echo', teamNumber: 2 }),
      makeEntry({ id: 'f', tierSlot: 2, tier: 2.5, discordNickname: 'Ez_Foxtrot', teamNumber: 2 }),
      makeEntry({ id: 'g', tierSlot: 3, tier: 3.5, discordNickname: 'Ez_Golf', teamNumber: 2 }),
      makeEntry({ id: 'h', tierSlot: 4, tier: 4.5, discordNickname: 'Ez_Hotel', teamNumber: 2 }),
    ];
  }

  // "팀 구성" 버튼은 항상 /api/scrim-roster/team-assignments 를 먼저 호출해
  // entries를 그 응답으로 갈아끼운다 — 이 스위트의 모든 테스트가 그 호출을 거치므로,
  // URL별로 다른 응답을 주는 공용 mock을 만든다.
  function stubFetchForTeamAssignmentsThen(entries: RosterEntry[], otherResponse: unknown) {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/scrim-roster/team-assignments') {
        return { ok: true, json: async () => ({ entries }) };
      }
      return { ok: true, json: async () => otherResponse };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('같은 티어 칼럼의 두 칸을 클릭하면 스왑 API를 호출하고 팀 번호가 맞바뀐다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    const alpha = table.getByText('Ez_Alpha');
    const echo = table.getByText('Ez_Echo');
    await userEvent.click(alpha);
    await userEvent.click(echo);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/swap',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entryIdA: 'a', entryIdB: 'e' }),
      }),
    );
  });

  it('다른 티어 칼럼을 클릭하면 스왑 없이 선택만 옮겨간다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    await userEvent.click(table.getByText('Ez_Alpha')); // 1티어
    await userEvent.click(table.getByText('Ez_Bravo')); // 2티어 — 다른 칼럼

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/scrim-roster/entries/swap',
      expect.anything(),
    );
  });

  it('"VIP 정렬" 버튼을 누르면 API를 호출하고 응답으로 02 표를 갱신한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const sorted = entries.map((entry) => (entry.id === 'e' ? { ...entry, teamNumber: 9 } : entry));
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { entries: sorted });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'VIP 정렬' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/vip-sort',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });
});
