import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 이 테스트가 지키는 것: 자동 크론은 **내전이 없는 날·이미 확정된 날에는 PUBG 를
// 부르지 않고**, 4경기가 다 찬 그 한 번에만 확정하고 알린다.

const pollScrim = vi.fn();
const confirmScrimWin = vi.fn();
const sendDiscord = vi.fn();

vi.mock('@/lib/scrimPoll', () => ({ pollScrim: (...a: unknown[]) => pollScrim(...a) }));
vi.mock('@/lib/scrimConfirm', () => ({
  REQUIRED_ROUNDS: 4,
  confirmScrimWin: (...a: unknown[]) => confirmScrimWin(...a),
}));
vi.mock('@/supabase/functions/_shared/notify.mjs', () => ({
  sendDiscord: (...a: unknown[]) => sendDiscord(...a),
  formatAutoConfirmMessage: () => 'auto-confirm-message',
}));

let tables: Record<string, unknown> = {};
function fakeSupabase() {
  let table = '';
  const chain: Record<string, unknown> = {
    from(name: string) {
      table = name;
      return chain;
    },
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
    insert: () => Promise.resolve({ error: null }),
  };
  return chain;
}
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseServer: () => fakeSupabase() }));

// eslint-disable-next-line import/first
import { POST } from './route';

const SECRET = 'service-role-test';
// 2026-11-12(목) 19:44 KST 에 올린 명단.
const ROSTER = { id: 'roster-1', fetched_at: '2026-11-12T10:44:54.573Z', low_tier: false };

function cron(auth = `Bearer ${SECRET}`) {
  return POST(
    new Request('http://localhost/api/cron/scrim-auto', {
      method: 'POST',
      headers: { authorization: auth },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T13:00:00Z')); // 22:00 KST
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  process.env.PUBG_API_KEY = 'pubg';
  process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/hook';
  tables = { scrim_rosters: ROSTER, session_standings: null };
  sendDiscord.mockResolvedValue(undefined);
  confirmScrimWin.mockResolvedValue({
    ok: true,
    scrimDate: '2026-11-12',
    teamNumber: 3,
    totalScore: 80,
    players: [],
    lowTier: false,
    savedTeams: 16,
    savedMembers: 64,
    teams: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.DISCORD_WEBHOOK_URL;
});

describe('자동 폴링 크론', () => {
  it('비밀값이 없거나 틀리면 401 이고 아무것도 안 한다', async () => {
    const res = await cron('Bearer nope');
    expect(res.status).toBe(401);
    expect(pollScrim).not.toHaveBeenCalled();
  });

  it('오늘 올린 명단이 없으면(내전 없는 날) PUBG 를 부르지 않는다', async () => {
    tables.scrim_rosters = null;
    const body = await (await cron()).json();
    expect(body.status).toBe('no-roster');
    expect(pollScrim).not.toHaveBeenCalled();
  });

  it('이미 확정된 내전이면 PUBG 를 부르지 않는다', async () => {
    tables.session_standings = { scrim_date: '2026-11-12' };
    const body = await (await cron()).json();
    expect(body.status).toBe('already-confirmed');
    expect(pollScrim).not.toHaveBeenCalled();
  });

  it('3경기까지면 기다린다 — 확정도 알림도 없다', async () => {
    pollScrim.mockResolvedValue({ found: true, scrimDate: '2026-11-12', roundCount: 3, sinceHours: 3 });
    const body = await (await cron()).json();
    expect(body.status).toBe('waiting');
    expect(pollScrim).toHaveBeenCalledWith(expect.anything(), { apiKey: 'pubg', rosterId: 'roster-1' });
    expect(confirmScrimWin).not.toHaveBeenCalled();
    expect(sendDiscord).not.toHaveBeenCalled();
  });

  it('4경기가 차면 확정하고 디스코드로 결과를 보낸다', async () => {
    pollScrim.mockResolvedValue({ found: true, scrimDate: '2026-11-12', roundCount: 4, sinceHours: 3 });
    const body = await (await cron()).json();
    expect(body.status).toBe('confirmed');
    expect(confirmScrimWin).toHaveBeenCalledWith(expect.anything(), {
      scrimDate: '2026-11-12',
      rosterId: 'roster-1',
      lowTier: false,
    });
    expect(sendDiscord).toHaveBeenCalledWith('https://discord.test/hook', 'auto-confirm-message');
  });

  it('저티어 토글은 명단에 저장된 값을 쓴다', async () => {
    tables.scrim_rosters = { ...ROSTER, low_tier: true };
    pollScrim.mockResolvedValue({ found: false, scrimDate: '2026-11-12', roundCount: 4, sinceHours: 3 });
    await cron();
    expect(confirmScrimWin).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lowTier: true }));
  });

  it('다른 날짜의 매치를 잡았으면 그 라운드 수로 오늘을 확정하지 않는다', async () => {
    pollScrim.mockResolvedValue({ found: true, scrimDate: '2026-11-13', roundCount: 4, sinceHours: 3 });
    const body = await (await cron()).json();
    expect(body.status).toBe('waiting');
    expect(confirmScrimWin).not.toHaveBeenCalled();
  });
});
