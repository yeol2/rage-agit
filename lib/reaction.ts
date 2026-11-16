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
 * 노란불(페이크). 한 판(5회) 시작마다 무작위 1회차는 반드시 노란불, 나머지 4회차는 각각 이 확률.
 * 0.15 면 1~2번 89%, 3번 이상 11%, 4번 이상 약 1%(2026-11-16 사용자 결정).
 */
export const FAKE_CHANCE = 0.15;
export const FAKE_SHOW_MS = 450;

/** 노란불이 들어가는 회차는 빨간불을 이만큼은 길게 — 노란불을 초록불보다 충분히 앞에 넣으려고. */
export const FAKE_WAIT_MIN_MS = 2200;

/**
 * 회차별 노란불 여부. 무작위 한 회차는 반드시 true(최소 1번 보장), 나머지는 chance 로 따로 굴린다
 * — 그래서 연속 회차로도 뜬다. 보장 회차를 "마지막까지 안 떴으면 5회차"로 두지 않는 건 예측을 막으려고.
 */
export function planFakeRounds(rounds = REACTION_ROUNDS, chance = FAKE_CHANCE, random = Math.random): boolean[] {
  const guaranteed = Math.floor(random() * rounds);
  return Array.from({ length: rounds }, (_, i) => i === guaranteed || random() < chance);
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

/** 평균이 빠른 순, 같으면 먼저 세운 사람이 위(명예의 전당과 같은 규칙). 같은 평균은 같은 등수. */
export function rankEntries(rows: Omit<ReactionRankEntry, 'rank'>[]): ReactionRankEntry[] {
  const sorted = [...rows].sort(
    (a, b) => a.bestAvgMs - b.bestAvgMs || a.achievedAt.localeCompare(b.achievedAt),
  );
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}
