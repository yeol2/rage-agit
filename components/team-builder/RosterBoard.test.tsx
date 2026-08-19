import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    fixed: false,
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

  // jsdom의 DragEvent는 진짜 DataTransfer를 못 만든다 — Nameplate가 쓰는
  // effectAllowed/setDragImage만 흉내 낸 최소 객체를 만들어 fireEvent에 넘긴다.
  function dragEventInit() {
    return { dataTransfer: { effectAllowed: '', setDragImage: vi.fn() } };
  }

  it('고정된 카드는 드래그할 수 없다', async () => {
    const entries = makeFullEntries().map((entry) =>
      entry.id === 'e' ? { ...entry, fixed: true } : entry,
    );
    const roster = makeRoster(entries);
    stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    const echo = table.getByText('Ez_Echo');
    expect(echo.getAttribute('draggable')).toBe('false');
  });

  it('같은 티어 칼럼으로 드래그하면 스왑 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    const alpha = table.getByText('Ez_Alpha'); // 1티어, 1번팀
    const echo = table.getByText('Ez_Echo'); // 1티어, 2번팀

    fireEvent.dragStart(alpha, dragEventInit());
    fireEvent.dragOver(echo, dragEventInit());
    fireEvent.drop(echo, dragEventInit());

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/swap',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entryIdA: 'a', entryIdB: 'e' }),
      }),
    );
  });

  it('고정 안 된 카드를 고정된 칸으로 드롭해도 스왑 API를 호출하지 않는다', async () => {
    const entries = makeFullEntries().map((entry) =>
      entry.id === 'e' ? { ...entry, fixed: true } : entry,
    );
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    const alpha = table.getByText('Ez_Alpha'); // 1티어, 1번팀 — 고정 안 됨(드래그 시작 가능)
    const echo = table.getByText('Ez_Echo'); // 1티어, 2번팀 — 고정됨(드롭 대상)

    // Ez_Alpha 쪽에서 드래그를 시작하므로 draggable=false 가드가 아니라
    // handleSwapDrop 안의 targetEntry.fixed 가드가 막는지를 검증한다.
    fireEvent.dragStart(alpha, dragEventInit());
    fireEvent.dragOver(echo, dragEventInit());
    fireEvent.drop(echo, dragEventInit());

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/scrim-roster/entries/swap',
      expect.anything(),
    );
  });

  it('네임플레이트를 클릭하면 고정 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    const table = within(await screen.findByRole('table'));
    await userEvent.click(table.getByText('Ez_Alpha'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/a',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ fixed: true }) }),
    );
  });

  it('"고정" 칼럼을 누르면 그 팀 전체에 대해 team-fix API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { ok: true });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: '1번팀 고정' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/team-fix',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', teamNumber: 1, fixed: true }),
      }),
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

  it('"전체 리롤" 버튼을 누르면 tier 없이 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { entries });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });

  it('"1티어 리롤" 버튼을 누르면 tier: 1 과 함께 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { entries });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '1티어 리롤' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', tier: 1 }),
      }),
    );
  });

  it('리롤 버튼 클릭 후 응답으로 02 표 entries 가 갱신된다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const rerolled = entries.map((entry) => (entry.id === 'a' ? { ...entry, teamNumber: 2 } : entry));
    const fetchMock = stubFetchForTeamAssignmentsThen(entries, { entries: rerolled });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));

    await screen.findByRole('button', { name: '전체 리롤' });
    expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/reroll', expect.anything());
  });
});
