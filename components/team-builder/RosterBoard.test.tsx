import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterBoard } from './RosterBoard';
import { useAdmin } from '@/components/admin/AdminProvider';
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

const ROUND_SHEET_GET_URL = '/api/scrim-roster/round-sheet?rosterId=roster-1';
const EMPTY_ROUND_SHEET = { roundCount: 0, teams: [] };

// 01(내전 시트)이 항상 같이 마운트돼서 모든 렌더가 이 GET을 한 번씩 부른다 —
// 02/03 관련 동작을 검증하는 테스트가 이 호출까지 일일이 신경 쓰지 않도록,
// 그 URL만 가로채고 나머지는 각 테스트가 준 대로 응답하는 라우터를 만든다.
function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === ROUND_SHEET_GET_URL && (!init || init.method === undefined)) {
      return { ok: true, json: async () => EMPTY_ROUND_SHEET };
    }
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function teamTable() {
  return screen.getByRole('table', { name: '팀 구성 표' });
}

describe('RosterBoard - 팀 구성', () => {
  it('1~4티어가 다 안 찼으면 팀 구성 버튼이 비활성화된다', () => {
    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1 })]);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));
    render(<RosterBoard roster={roster} />);
    expect(screen.getByRole('button', { name: '팀 구성' })).toBeDisabled();
  });

  it('03 팀 구성 표는 팀 구성 버튼을 누르기 전에도 항상 보인다(빈 칸으로)', () => {
    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1 })]);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));
    render(<RosterBoard roster={roster} />);
    expect(teamTable()).toBeInTheDocument();
  });

  it('1~4티어가 다 차면 버튼 클릭 시 API를 호출하고 03 표를 채운다', async () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha' }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2, discordNickname: 'Ez_Bravo' }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3, discordNickname: 'Ez_Charlie' }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4, discordNickname: 'Ez_Delta' }),
    ];
    const roster = makeRoster(entries);
    const assigned = entries.map((entry) => ({ ...entry, teamNumber: 1 }));

    const fetchMock = stubFetch(() => ({ ok: true, json: async () => ({ entries: assigned }) }));

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    // Ez_Delta는 02 티어 칸에도 그대로 남아 있고 03 표에도 새로 나타나므로 두 번 나온다.
    await waitFor(() => expect(screen.getAllByText('Ez_Delta').length).toBe(2));
    expect(within(teamTable()).getByText('Ez_Delta')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/team-assignments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });

  it('API가 실패를 응답하면 에러 메시지를 보여주고 표는 안 채워진다', async () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0 }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2 }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3 }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4 }),
    ];
    const roster = makeRoster(entries);

    stubFetch(() => ({ ok: false, json: async () => ({ error: '팀 구성에 실패했습니다.' }) }));

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    expect(await screen.findByText('팀 구성에 실패했습니다.')).toBeInTheDocument();
    // 실패했으니 표 안에는 이름표(Ez_Test)가 하나도 안 들어가고 빈 칸만 있어야 한다.
    expect(within(teamTable()).queryByText('Ez_Test')).not.toBeInTheDocument();
  });

  // 다른 관리자가 그 사이 명단을 바꿔서 이 화면의 entries 가 오래된 상태일
  // 때(같은 값을 보고도 서버는 다르게 판단해 거절할 때) 실패로 끝내지 않고
  // 최신 명단을 다시 받아온다 — 안 그러면 관리자는 "방금까지 16이었는데
  // 왜 안 되지"라고 밖에 못 느낀다.
  it('팀 구성 실패 후 최신 명단을 다시 받아와 화면을 바로잡는다', async () => {
    const staleEntries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0 }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2 }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3 }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4 }),
    ];
    // 다른 관리자가 다섯 번째 사람(e, 1티어)을 그 사이 추가해둔 걸 흉내낸다.
    const freshEntries = [
      ...staleEntries,
      makeEntry({ id: 'e', discordNickname: 'Ez_Echo', tierSlot: 1, tier: 1.5 }),
    ];
    const roster = makeRoster(staleEntries);

    const fetchMock = stubFetch((url) => {
      if (url === '/api/scrim-roster/team-assignments') {
        return { ok: false, json: async () => ({ error: '1~4티어가 모두 정확히 채워져야 팀을 구성할 수 있습니다.' }) };
      }
      if (url === '/api/scrim-roster/entries/list?rosterId=roster-1') {
        return { ok: true, json: async () => ({ entries: freshEntries }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '팀 구성' }));

    expect(
      await screen.findByText('1~4티어가 모두 정확히 채워져야 팀을 구성할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/entries/list?rosterId=roster-1');
    // 새로 추가된 사람(Ez_Echo)이 02 표(보류 칸)에 보여야 화면이 갱신됐다는 뜻이다.
    expect(await screen.findByText('Ez_Echo')).toBeInTheDocument();
  });

  it('team_number 가 이미 있는 로스터는 새로고침해도 03 표가 바로 채워져 있다', () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0, teamNumber: 1 }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2, teamNumber: 1 }),
      makeEntry({ id: 'c', tierSlot: 3, tier: 3, teamNumber: 1 }),
      makeEntry({ id: 'd', tierSlot: 4, tier: 4, teamNumber: 1 }),
    ];
    const roster = makeRoster(entries);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));

    render(<RosterBoard roster={roster} />);

    expect(within(teamTable()).getAllByText('Ez_Test').length).toBe(4);
  });

  it('01 내전 시트는 팀 구성 여부와 무관하게 처음부터 보인다', async () => {
    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1 })]);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));

    render(<RosterBoard roster={roster} />);

    expect(await screen.findByText('경기 0개 기록됨')).toBeInTheDocument();
  });
});

describe('RosterBoard - 카드 삭제', () => {
  it('X 버튼을 누르면 DELETE API를 호출하고 카드를 화면에서 뺀다', async () => {
    const entries = [makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha' })];
    const roster = makeRoster(entries);
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => ({ ok: true }) }));

    render(<RosterBoard roster={roster} />);
    expect(screen.getByText('Ez_Alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ez_Alpha 삭제' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/entries/a', { method: 'DELETE' });
    await waitFor(() => expect(screen.queryByText('Ez_Alpha')).not.toBeInTheDocument());
  });

  it('삭제가 실패하면 카드를 되돌리고 에러 메시지를 보여준다', async () => {
    const entries = [makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha' })];
    const roster = makeRoster(entries);
    stubFetch(() => ({ ok: false, json: async () => ({ error: '실패' }) }));

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ez_Alpha 삭제' }));

    expect(await screen.findByText('삭제하지 못했습니다. 다시 시도하세요.')).toBeInTheDocument();
    expect(screen.getByText('Ez_Alpha')).toBeInTheDocument();
  });

  it('보류 칸의 카드도 티어 칸과 같은 폭(width prop)으로 렌더링된다', () => {
    const entries = [makeEntry({ id: 'a', tierSlot: null, tier: 0, discordNickname: 'Ez_Alpha' })];
    const roster = makeRoster(entries);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));

    render(<RosterBoard roster={roster} />);
    const card = screen.getByText('Ez_Alpha');
    expect(card).toHaveStyle({ width: '121px' });
  });
});

describe('RosterBoard - 02 되돌리기(다단계)', () => {
  // jsdom의 DragEvent는 진짜 DataTransfer를 못 만든다 — Nameplate가 쓰는
  // effectAllowed/setDragImage만 흉내 낸 최소 객체를 만들어 fireEvent에 넘긴다.
  function dragEventInit() {
    return { dataTransfer: { effectAllowed: '', setDragImage: vi.fn() } };
  }

  it('두 번 드래그로 옮기면 "되돌리기"를 두 번 눌러 하나씩 거슬러 올라간다', async () => {
    const entries = [
      makeEntry({ id: 'a', tierSlot: 1, tier: 0, discordNickname: 'Ez_Alpha' }),
      makeEntry({ id: 'b', tierSlot: 2, tier: 2, discordNickname: 'Ez_Bravo' }),
    ];
    const roster = makeRoster(entries);
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => ({ ok: true }) }));

    render(<RosterBoard roster={roster} />);
    const undoButton = screen.getByRole('button', { name: '되돌리기' });
    expect(undoButton).toBeDisabled();

    const alpha = screen.getByText('Ez_Alpha');
    const tier2Section = screen.getByText(/2티어 \(2~2\.5\)/).closest('section')!;
    fireEvent.dragStart(alpha, dragEventInit());
    fireEvent.drop(tier2Section, dragEventInit());

    await waitFor(() => expect(undoButton).not.toBeDisabled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/a',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tierSlot: 2 }) }),
    );

    const bravo = screen.getByText('Ez_Bravo');
    const tier3Section = screen.getByText(/3티어 \(3~3\.5\)/).closest('section')!;
    fireEvent.dragStart(bravo, dragEventInit());
    fireEvent.drop(tier3Section, dragEventInit());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/scrim-roster/entries/b',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tierSlot: 3 }) }),
      ),
    );

    await userEvent.click(undoButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/scrim-roster/entries/b',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tierSlot: 2 }) }),
      ),
    );
    expect(undoButton).not.toBeDisabled();

    await userEvent.click(undoButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/scrim-roster/entries/a',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tierSlot: 1 }) }),
      ),
    );
    expect(undoButton).toBeDisabled();
  });
});

describe('RosterBoard - 03 표 스왑 / VIP 정렬', () => {
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

  // team_number 가 이미 있는 로스터를 그대로 넘기면 03 표가 처음부터 채워져
  // 있어서, 이 스위트의 테스트들은 "팀 구성" 버튼을 누를 필요가 없다.
  function stubFetchForOtherCalls(otherResponse: unknown) {
    return stubFetch(() => ({ ok: true, json: async () => otherResponse }));
  }

  // jsdom의 DragEvent는 진짜 DataTransfer를 못 만든다.
  function dragEventInit() {
    return { dataTransfer: { effectAllowed: '', setDragImage: vi.fn() } };
  }

  it('고정된 카드는 드래그할 수 없다', async () => {
    const entries = makeFullEntries().map((entry) =>
      entry.id === 'e' ? { ...entry, fixed: true } : entry,
    );
    const roster = makeRoster(entries);
    stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    const table = within(teamTable());
    const echo = table.getByText('Ez_Echo');
    expect(echo.getAttribute('draggable')).toBe('false');
  });

  it('같은 티어 칼럼으로 드래그하면 스왑 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    const table = within(teamTable());
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

  it('드래그하면 실제로 바뀔 상대 칸에 강조 표시가 뜬다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    const table = within(teamTable());
    const alpha = table.getByText('Ez_Alpha'); // 1티어, 1번팀
    const echo = table.getByText('Ez_Echo'); // 1티어, 2번팀 — 같은 칼럼이라 유효한 상대
    const bravo = table.getByText('Ez_Bravo'); // 2티어, 1번팀 — 다른 칼럼이라 무효한 상대

    fireEvent.dragStart(alpha, dragEventInit());
    fireEvent.dragOver(echo, dragEventInit());
    expect(echo.closest('td')?.querySelector('[class*="shadow-"]')).toBeInTheDocument();

    fireEvent.dragOver(bravo, dragEventInit());
    expect(bravo.closest('td')?.querySelector('[class*="shadow-"]')).not.toBeInTheDocument();
  });

  it('고정 안 된 카드를 고정된 칸으로 드롭해도 스왑 API를 호출하지 않는다', async () => {
    const entries = makeFullEntries().map((entry) =>
      entry.id === 'e' ? { ...entry, fixed: true } : entry,
    );
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    const table = within(teamTable());
    const alpha = table.getByText('Ez_Alpha'); // 1티어, 1번팀 — 고정 안 됨(드래그 시작 가능)
    const echo = table.getByText('Ez_Echo'); // 1티어, 2번팀 — 고정됨(드롭 대상)

    fireEvent.dragStart(alpha, dragEventInit());
    fireEvent.dragOver(echo, dragEventInit());
    fireEvent.drop(echo, dragEventInit());

    expect(fetchMock).not.toHaveBeenCalledWith('/api/scrim-roster/entries/swap', expect.anything());
  });

  it('네임플레이트를 클릭하면 고정 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    const table = within(teamTable());
    await userEvent.click(table.getByText('Ez_Alpha'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/a',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ fixed: true }) }),
    );
  });

  it('"고정" 칼럼을 누르면 그 팀 전체에 대해 team-fix API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ ok: true });

    render(<RosterBoard roster={roster} />);

    await userEvent.click(screen.getByRole('button', { name: '1번팀 고정' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/entries/team-fix',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', teamNumber: 1, fixed: true }),
      }),
    );
  });

  it('"VIP 정렬" 버튼을 누르면 API를 호출하고 응답으로 03 표를 갱신한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const sorted = entries.map((entry) => (entry.id === 'e' ? { ...entry, teamNumber: 9 } : entry));
    const fetchMock = stubFetchForOtherCalls({ entries: sorted });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: 'VIP 정렬' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/vip-sort',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });

  it('"전체 리롤" 버튼을 누르면 tier 없이 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ entries });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ rosterId: 'roster-1' }) }),
    );
  });

  it('"1티어 리롤" 버튼을 누르면 tier: 1 과 함께 API를 호출한다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const fetchMock = stubFetchForOtherCalls({ entries });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '1티어 리롤' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', tier: 1 }),
      }),
    );
  });

  it('리롤 버튼 클릭 후 응답으로 03 표 entries 가 갱신된다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const rerolled = entries.map((entry) => (entry.id === 'a' ? { ...entry, teamNumber: 2 } : entry));
    const fetchMock = stubFetchForOtherCalls({ entries: rerolled });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));

    await screen.findByRole('button', { name: '전체 리롤' });
    expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/reroll', expect.anything());
  });

  // team_number 를 바꾸는 UPDATE 는 같은 roster 행을 고치는 것이라 rosterId 는
  // 안 바뀐다. 01(RoundSheet)이 rosterId 만 보고 있으면 최초 한 번 불러온 뒤로
  // 다시 안 불러와서, 02에서 팀을 다시 짜도 01이 예전 팀 그대로 남는 버그가
  // 실제로 있었다 — teamsVersion 을 의존성에 넣어 고쳤다.
  it('리롤이 성공하면 01 시트도 team_number 를 다시 읽어온다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const rerolled = entries.map((entry) => (entry.id === 'a' ? { ...entry, teamNumber: 2 } : entry));
    const fetchMock = stubFetchForOtherCalls({ entries: rerolled });
    const sheetCallCount = () =>
      fetchMock.mock.calls.filter(([url]) => url === ROUND_SHEET_GET_URL).length;

    render(<RosterBoard roster={roster} />);
    await waitFor(() => expect(sheetCallCount()).toBeGreaterThan(0));
    const beforeReroll = sheetCallCount();

    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));
    await screen.findByRole('button', { name: '전체 리롤' });

    await waitFor(() => expect(sheetCallCount()).toBeGreaterThan(beforeReroll));
  });

  it('리롤 전에는 "리롤 되돌리기" 버튼이 비활성화돼 있다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    stubFetchForOtherCalls({ entries });

    render(<RosterBoard roster={roster} />);

    expect(screen.getByRole('button', { name: '리롤 되돌리기' })).toBeDisabled();
  });

  it('리롤 후 "리롤 되돌리기"를 누르면 리롤 직전 team_number로 복원하는 changes를 보낸다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    // a는 원래 1번팀 — 리롤 응답에서 3번팀으로 바뀐 걸로 흉내낸다.
    const rerolled = entries.map((entry) => (entry.id === 'a' ? { ...entry, teamNumber: 3 } : entry));
    const fetchMock = stubFetch((url) => {
      if (url === '/api/scrim-roster/reroll') return { ok: true, json: async () => ({ entries: rerolled }) };
      if (url === '/api/scrim-roster/reroll/undo') return { ok: true, json: async () => ({ entries }) };
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '리롤 되돌리기' })).not.toBeDisabled());

    await userEvent.click(screen.getByRole('button', { name: '리롤 되돌리기' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll/undo',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', changes: [{ id: 'a', teamNumber: 1 }] }),
      }),
    );
  });

  it('되돌리기를 두 번 누르면 두 번째는 그 전 스냅샷을 쓴다', async () => {
    const entries = makeFullEntries();
    const roster = makeRoster(entries);
    const afterFirstReroll = entries.map((entry) => (entry.id === 'a' ? { ...entry, teamNumber: 3 } : entry));
    const afterSecondReroll = afterFirstReroll.map((entry) =>
      entry.id === 'a' ? { ...entry, teamNumber: 5 } : entry,
    );
    let rerollCount = 0;
    const fetchMock = stubFetch((url) => {
      if (url === '/api/scrim-roster/reroll') {
        rerollCount += 1;
        return { ok: true, json: async () => ({ entries: rerollCount === 1 ? afterFirstReroll : afterSecondReroll }) };
      }
      if (url === '/api/scrim-roster/reroll/undo') return { ok: true, json: async () => ({ entries: afterFirstReroll }) };
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<RosterBoard roster={roster} />);
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/scrim-roster/reroll', expect.anything()));
    await userEvent.click(screen.getByRole('button', { name: '전체 리롤' }));
    await waitFor(() => expect(rerollCount).toBe(2));

    await userEvent.click(screen.getByRole('button', { name: '리롤 되돌리기' }));

    // 두 번째 리롤(5번팀)을 되돌리는 거니까 그 직전 스냅샷인 3번팀으로 복원돼야 한다.
    // 마지막 호출이 아니라 있었는지만 본다 — 되돌리기 성공은 teamsVersion을 올려
    // 01 시트가 team_number를 다시 읽어오게 하므로, 그 뒤에 round-sheet GET이
    // 한 번 더 따라붙는다(01이 바뀐 팀 배정을 놓치지 않는지 확인하는 테스트가 따로 있다).
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scrim-roster/reroll/undo',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rosterId: 'roster-1', changes: [{ id: 'a', teamNumber: 3 }] }),
      }),
    );
  });
});

describe('RosterBoard - 02 종합점수 배지(관리자 전용)', () => {
  it('일반 사용자에게는 점수가 안 보인다', () => {
    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1, memberId: 'mem-a' })]);
    stubFetch(() => ({ ok: true, json: async () => EMPTY_ROUND_SHEET }));
    render(<RosterBoard roster={roster} />);
    expect(screen.queryByText(/^\d+\.\d$/)).not.toBeInTheDocument();
  });

  it('관리자에게는 매칭된 멤버의 종합점수가 보인다', async () => {
    vi.mocked(useAdmin).mockReturnValue({ isAdmin: true, login: vi.fn(), logout: vi.fn() });
    stubFetch((url) => {
      if (url === '/api/rage-scores?window=recent16') {
        return { ok: true, json: async () => ({ scores: { 'mem-a': 82.3 } }) };
      }
      return { ok: true, json: async () => EMPTY_ROUND_SHEET };
    });

    const roster = makeRoster([makeEntry({ id: 'a', tierSlot: 1, memberId: 'mem-a' })]);
    render(<RosterBoard roster={roster} />);

    await waitFor(() => expect(screen.getByText('82.3')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/rage-scores?window=recent16');
  });
});
