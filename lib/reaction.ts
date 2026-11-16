// 놀이터 · 반응속도 테스트의 규칙. 화면(ReactionTest)과 서버(/api/reaction)가 같은 값을 본다.

/** 한 판 = 이만큼 성공해야 끝난다. 너무 빨리 누름·페이크는 그 회차를 다시 한다. */
export const REACTION_ROUNDS = 5;

/** 초록불 뒤 이보다 빠른 클릭은 사람이 본 게 아니라 찍은 것 — "너무 빨라요"로 친다. */
export const MIN_HUMAN_MS = 100;

/** 이보다 느리면 딴짓한 것 — 기록은 보여주되 랭킹에는 못 올린다. */
export const MAX_RECORD_MS = 2000;

/** 빨간불(대기)이 이어지는 시간. 매번 이 사이에서 무작위. */
export const WAIT_MIN_MS = 1500;
export const WAIT_MAX_MS = 4500;

/**
 * 노란불(페이크). 한 판(5회)에 최소 2개 — 1~3회차 중 하나, 4~5회차 중 하나는 반드시(2026-11-16
 * 사용자 결정). 앞에서 한 번 보면 "이제 안 나온다"고 예측하고 막 누르는 사람이 있어서다.
 * 거기에 3번 각각 이 확률로 1개씩 더(아무 회차에나). 0.15 면 2개 61%, 3개 33%, 4개 이상 6%.
 */
export const FAKE_CHANCE = 0.15;
const FAKE_EXTRA_ROLLS = 3;
/** 보장 노란불이 하나씩 들어가는 회차 묶음(0부터): 1~3회차, 4~5회차. */
const FAKE_GUARANTEED_GROUPS: number[][] = [
  [0, 1, 2],
  [3, 4],
];

/** 노란불이 켜져 있는 시간 — 1초 이상(2026-11-16 사용자 결정). 매번 이 사이 무작위. */
export const FAKE_SHOW_MIN_MS = 1000;
export const FAKE_SHOW_MAX_MS = 1500;

/**
 * 노란불이 꺼지고 다음 불(초록 또는 또 노랑)이 켜질 때까지 — 1초 이상(2026-11-16 사용자 결정).
 * 0.5초 만에 초록이 붙어 나오면 "참았는데 바로 초록" 억까라는 후기가 있어서 늘렸다.
 * 딱 1초로 고정하면 "노랑 꺼지고 1초 뒤"에 미리 눌러 반응 없이 기록을 낼 수 있어서 1~2초 무작위다.
 */
export const AFTER_FAKE_GAP_MIN_MS = 1000;
export const AFTER_FAKE_GAP_MAX_MS = 2000;

/**
 * 회차별 노란불 개수(5칸). 보장 2개는 각 묶음 안의 무작위 회차에, 추가분은 아무 회차에나 떨어뜨린다 —
 * 같은 회차에 두 개가 떨어지면 그 회차는 노랑 → 빨강 → 노랑 → 빨강 → 초록으로 이어 나온다.
 * 그래서 앞에서 노란불을 봤어도 뒤에 또 나오고, 한 회차 안에서도 또 나올 수 있다.
 */
export function planFakeRounds(chance = FAKE_CHANCE, random = Math.random): number[] {
  const plan = new Array<number>(REACTION_ROUNDS).fill(0);
  for (const group of FAKE_GUARANTEED_GROUPS) plan[group[Math.floor(random() * group.length)]]++;
  for (let i = 0; i < FAKE_EXTRA_ROLLS; i++) {
    if (random() < chance) plan[Math.floor(random() * REACTION_ROUNDS)]++;
  }
  return plan;
}

export interface FakeWindow {
  /** 노란불 켜지는 시각 */
  on: number;
  /** 노란불 꺼지는 시각 */
  off: number;
}

/**
 * 한 회차의 불 켜지는 시각(빨간불 시작부터 ms). 첫 불(노랑이든 초록이든)은 firstWait 에 켜진다 —
 * 노란불 회차와 그냥 회차의 첫 대기가 같은 분포라 대기 시간으로는 구분이 안 된다.
 * 노랑은 1~1.5초 켜졌다 꺼지고, 꺼진 뒤 1~2초 빨강을 거쳐 다음 불.
 */
export function roundTimeline(
  firstWait: number,
  fakes: number,
  random = Math.random,
): { fakes: FakeWindow[]; goAt: number } {
  const between = (min: number, max: number) => min + random() * (max - min);
  const windows: FakeWindow[] = [];
  let t = firstWait;
  for (let i = 0; i < fakes; i++) {
    const off = t + between(FAKE_SHOW_MIN_MS, FAKE_SHOW_MAX_MS);
    windows.push({ on: t, off });
    t = off + between(AFTER_FAKE_GAP_MIN_MS, AFTER_FAKE_GAP_MAX_MS);
  }
  return { fakes: windows, goAt: t };
}

export interface ReactionRankEntry {
  rank: number;
  memberId: string;
  name: string;
  tier: number;
  bestAvgMs: number;
  bestSingleMs: number;
  attempts: number;
  achievedAt: string;
}

export function average(times: number[]): number {
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
}

/**
 * 매크로 거르기(③). 억울한 사람이 안 나오게 빡빡하게만 잡는다(2026-11-16 사용자 결정).
 *   - 5회 표준편차 5ms 미만 = 거의 복사한 기록. 꾸준한 사람(±15ms)도 우연히 걸릴 확률 약 2%, 보통 사람은 1% 미만.
 *   - 5회 평균 130ms 미만 = 브라우저 지연까지 낀 상태에서 사람이 내기 어려운 속도.
 */
export const MIN_AVG_MS = 130;
export const MIN_SPREAD_MS = 5;

/** 표본 표준편차(n-1). */
export function spread(times: number[]): number {
  const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
  return Math.sqrt(times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / (times.length - 1));
}

/** 사람이 했다고 보기 어려운 기록이면 그 이유, 괜찮으면 null. */
export function suspiciousReason(times: number[]): string | null {
  if (average(times) < MIN_AVG_MS) return `평균 ${MIN_AVG_MS}ms 미만은 사람이 내기 어려운 기록이라 랭킹에 올릴 수 없어요.`;
  if (spread(times) < MIN_SPREAD_MS) return '5회 기록이 거의 똑같아서 매크로로 의심돼요. 랭킹에 올릴 수 없어요.';
  return null;
}

/** 랭킹에 올릴 수 있는 기록인지. 서버가 그대로 다시 검사한다(브라우저 값은 믿지 않는다). */
export function isValidRun(times: unknown): times is number[] {
  return (
    Array.isArray(times) &&
    times.length === REACTION_ROUNDS &&
    times.every((t) => Number.isInteger(t) && t >= MIN_HUMAN_MS && t <= MAX_RECORD_MS)
  );
}

/** 평균이 빠른 순, 같으면 먼저 세운 사람이 위(명예의 전당과 같은 규칙) — 등수는 겹치지 않고 1, 2, 3… */
export function rankEntries(rows: Omit<ReactionRankEntry, 'rank'>[]): ReactionRankEntry[] {
  const sorted = [...rows].sort(
    (a, b) => a.bestAvgMs - b.bestAvgMs || a.achievedAt.localeCompare(b.achievedAt),
  );
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}
