import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 이 테스트가 지키는 것은 하나다: **등수 스냅샷이 내전보다 먼저 찍히지 않는다.**
//
// 2026-09-03 내전에서 스냅샷이 20:35:08 에 찍혔고 1라운드는 20:36:25 에 들어왔다.
// 경기가 한 판도 없는 시점의 순위가 "오늘 내전 결과"로 저장된 것이라, 리더보드의
// 변동 배지가 한 내전씩 밀렸다 — 오늘 참가도 안 한 사람이 ▲10 으로 보였다.
//
// 원인은 "폴링이 아무것도 못 잡았을 때 무슨 날짜의 라운드를 세느냐"였다. 예전엔
// DB 에서 가장 최근 내전을 집었는데, 오늘 세션이 아직 없으면 그게 **지난 내전**을
// 가리키고 지난 내전은 늘 4라운드가 차 있다.

const runPolling = vi.fn();
const buildRoundSheet = vi.fn();
const captureRankingSnapshotForRoster = vi.fn();
const revalidatePath = vi.fn();
const revalidateRecordPages = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock('@/supabase/functions/_shared/polling.mjs', () => ({
  runPolling: (...args: unknown[]) => runPolling(...args),
}));
vi.mock('@/lib/roundSheetData', () => ({
  buildRoundSheet: (...args: unknown[]) => buildRoundSheet(...args),
  latestScrimDate: vi.fn(),
}));
vi.mock('@/lib/rankingSnapshot', () => ({
  captureRankingSnapshotForRoster: (...args: unknown[]) => captureRankingSnapshotForRoster(...args),
}));
vi.mock('@/lib/revalidateRecordPages', () => ({
  revalidateRecordPages: () => revalidateRecordPages(),
}));

// 로스터는 2026-09-03 저녁 19:41 KST 에 올렸다(실제 값). 그 저녁이 곧 그 내전이다.
const ROSTER_FETCHED_AT = '2026-09-03T10:41:03.427Z';

// 조회 체인은 전부 자기 자신을 돌려주고, 끝에서 테이블별 결과만 낸다.
function fakeSupabase(resultByTable: Record<string, unknown>) {
  let table = '';
  const chain: Record<string, unknown> = {
    from(name: string) {
      table = name;
      return chain;
    },
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    maybeSingle: () => Promise.resolve({ data: resultByTable[table] ?? null, error: null }),
  };
  return chain;
}

vi.mock('@/lib/supabaseServer', () => ({
  getSupabaseServer: () =>
    fakeSupabase({
      scrim_rosters: { fetched_at: ROSTER_FETCHED_AT },
      scrim_roster_entries: null,
    }),
}));

// eslint-disable-next-line import/first
import { POST } from './route';

function pollRequest() {
  return new Request('http://localhost/api/scrim-roster/round-sheet/poll', {
    method: 'POST',
    body: JSON.stringify({ rosterId: 'roster-1', attempt: 1 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUBG_API_KEY = 'test-key';
  // 버튼을 누른 직후에는 PUBG 서버에 아직 안 올라와 있어 아무것도 못 잡는다.
  runPolling.mockResolvedValue({ scrims: [], scrimsFound: 0 });
  // 라우트가 .catch() 를 붙여 부르므로 프로미스를 돌려줘야 한다.
  captureRankingSnapshotForRoster.mockResolvedValue({ captured: true });
});

afterEach(() => {
  delete process.env.DISCORD_WEBHOOK_URL;
});

describe('폴링 라우트 — 등수 스냅샷 캡처 시점', () => {
  it('아무것도 못 잡았으면 이 로스터의 날짜를 센다 — 지난 내전이 아니다', async () => {
    buildRoundSheet.mockResolvedValue({ roundCount: 0 });

    await POST(pollRequest());

    // 예전 버그는 여기서 '2026-08-30'(지난 내전)을 세었다.
    expect(buildRoundSheet).toHaveBeenCalledWith(expect.anything(), '2026-09-03');
  });

  it('오늘 라운드가 아직 0개면 스냅샷을 찍지 않는다', async () => {
    // 지난 내전은 4라운드가 다 차 있지만, 세는 대상이 오늘이라 0 이 나온다.
    buildRoundSheet.mockResolvedValue({ roundCount: 0 });

    await POST(pollRequest());

    expect(captureRankingSnapshotForRoster).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalledWith('/dashboard');
  });

  it('1~3라운드까지 들어온 상태에서도 찍지 않는다 — 반쪽 순위가 저장되면 안 된다', async () => {
    buildRoundSheet.mockResolvedValue({ roundCount: 3 });

    await POST(pollRequest());

    expect(captureRankingSnapshotForRoster).not.toHaveBeenCalled();
  });

  // 못 잡았다고 무조건 건너뛰면, 4번째가 다른 경로(CLI 폴링 등)로 먼저 들어간 뒤
  // 버튼을 눌렀을 때 캡처를 영영 놓친다. 그 구제는 그대로 살아 있어야 한다.
  it('못 잡았어도 오늘 4라운드가 다 차 있으면 찍는다', async () => {
    buildRoundSheet.mockResolvedValue({ roundCount: 4 });

    await POST(pollRequest());

    expect(captureRankingSnapshotForRoster).toHaveBeenCalledWith(expect.anything(), 'roster-1');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('매치를 잡았으면 그 매치의 날짜를 센다 — 로스터 날짜보다 이쪽이 우선이다', async () => {
    runPolling.mockResolvedValue({
      scrims: [{ playedAt: '2026-09-03T12:46:51.000Z' }],
      scrimsFound: 1,
    });
    buildRoundSheet.mockResolvedValue({ roundCount: 4 });

    await POST(pollRequest());

    expect(buildRoundSheet).toHaveBeenCalledWith(expect.anything(), '2026-09-03');
    expect(captureRankingSnapshotForRoster).toHaveBeenCalled();
  });
});
