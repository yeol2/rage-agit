// 놀이터 · 반응속도 테스트의 규칙. 화면(ReactionTest)과 서버(/api/reaction)가 같은 값을 본다.

/** 한 판 = 이만큼 성공해야 끝난다. 너무 빨리 누름·페이크는 그 회차를 다시 한다. */
export const REACTION_ROUNDS = 5;

/** 초록불 뒤 이보다 빠른 클릭은 사람이 본 게 아니라 찍은 것 — "너무 빨라요"로 친다. */
export const MIN_HUMAN_MS = 100;

/** 이보다 느리면 딴짓한 것 — 기록은 보여주되 랭킹에는 못 올린다. */
export const MAX_RECORD_MS = 2000;

/**
 * 빨간불(대기)에서 다음 불(노랑 또는 초록)이 켜질 때까지. 회차 시작이든 노란불이 꺼진 뒤든 똑같이
 * 이 사이에서 무작위(2026-11-16 사용자 결정 — 둘을 같은 범위로 통일, 1~6.5초 → 1~4.3초). 범위가 넓어서 "몇 초쯤 뒤에
 * 바뀐다"는 감으로 미리 찍기 어렵다.
 */
export const WAIT_MIN_MS = 1000;
export const WAIT_MAX_MS = 4300;

/**
 * 노란불(페이크). 불이 하나 켜질 때마다 노랑 25% / 초록 75% 로 따로 뽑는다(30%→25%, 한 판 평균 약 2.2개) — 빨간불 다음에도,
 * 노란불이 꺼진 다음에도 똑같이, 앞 결과와 상관없이(2026-11-16 사용자 결정). 확률이 언제나 같아서
 * "앞에서 봤으니 이제 안 나온다" 같은 예측이 안 된다.
 *
 * 다만 노란불이 하나도 없는 판(그냥 뽑으면 약 17%)은 버리고 다시 뽑는다 — 최소 1번 보장(2026-11-16).
 * 노란불 없는 판에선 "색이 바뀌면 무조건 누르기"가 안 걸려서, 노란불에 낚일 때마다 다시 시작해
 * 노란불 없는 판이 걸릴 때까지 무한 리트하는 꼼수가 있었다.
 */
export const FAKE_CHANCE = 0.25;
/** 한 회차에 노란불이 연속으로 나올 수 있는 최대 횟수(2026-11-16 사용자 결정). 5연속 확률 약 0.24%. */
const FAKE_MAX_PER_ROUND = 5;

/** 노란불이 켜져 있는 시간 — 1초 이상(2026-11-16 사용자 결정). 매번 이 사이 무작위. */
export const FAKE_SHOW_MIN_MS = 1000;
export const FAKE_SHOW_MAX_MS = 1500;

/**
 * 노란불이 꺼지고 다음 불(초록 또는 또 노랑)이 켜질 때까지 — 회차 시작 대기와 같은 1~4.3초(위 WAIT_*).
 * 최소 1초는 "참았는데 바로 초록" 억까 후기 때문, 무작위는 "노랑 꺼지고 몇 초 뒤"에 미리 찍지 못하게.
 */
export const AFTER_FAKE_GAP_MIN_MS = WAIT_MIN_MS;
export const AFTER_FAKE_GAP_MAX_MS = WAIT_MAX_MS;

/**
 * 회차별 노란불 개수(5칸). 불마다 chance 로 노랑, 아니면 초록에서 끝(최대 FAKE_MAX_PER_ROUND 연속) —
 * 두 개 이상이면 그 회차는 노랑 → 빨강 → 노랑 → 빨강 → 초록으로 이어 나온다.
 * 노란불이 0개면 다시 뽑는다(최소 1번). chance 가 아주 작아 계속 0개면 100번째에 무작위 회차에 1개를 넣는다.
 */
export function planFakeRounds(chance = FAKE_CHANCE, random = Math.random): number[] {
  const draw = () =>
    Array.from({ length: REACTION_ROUNDS }, () => {
      let count = 0;
      while (count < FAKE_MAX_PER_ROUND && random() < chance) count++;
      return count;
    });
  for (let attempt = 0; attempt < 100; attempt++) {
    const plan = draw();
    if (plan.some((n) => n > 0)) return plan;
  }
  const plan = new Array<number>(REACTION_ROUNDS).fill(0);
  plan[Math.floor(random() * REACTION_ROUNDS)] = 1;
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
 * 노랑은 1~1.5초 켜졌다 꺼지고, 꺼진 뒤 1~4.3초 빨강을 거쳐 다음 불.
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
  /** 한 줄 평. 안 썼으면 null. */
  comment: string | null;
}

/** 한 줄 평 최대 글자 수 — 랭킹 한 줄(이름 아래)에 들어가는 길이(2026-11-16 사용자 결정, 20→30). DB 제약(0051)과 같다. */
export const COMMENT_MAX_CHARS = 30;

/** 글자 수(이모지·한글 한 글자를 1로). */
export function commentLength(text: string): number {
  return Array.from(text).length;
}

/**
 * 한 줄 평 정리. 줄바꿈·연속 공백은 공백 하나로, 앞뒤 공백은 지운다. 비면 null.
 * 문자열이 아니면 null, 정리 후 COMMENT_MAX_CHARS 를 넘으면 'too-long'.
 */
export function normalizeComment(input: unknown): string | null | 'too-long' {
  if (typeof input !== 'string') return null;
  const text = input.replace(/\s+/g, ' ').trim();
  if (text === '') return null;
  return commentLength(text) > COMMENT_MAX_CHARS ? 'too-long' : text;
}

/**
 * 결과 화면 한마디 — 5회 평균을 30ms 단위로 10구간(2026-11-16 사용자 결정). 사람 평균(250~300ms)
 * 근처를 "평균"으로 잡았다. [이 값 미만, 멘트] 순서로, 마지막 줄은 그 이상 전부.
 */
const VERDICTS: [number, string][] = [
  [150, 'WOW.. 매크로시죠? 의심할께요'],
  [180, '에임봇 의심됨. 핵 검사 받으러 가실게요'],
  [210, '발자국 소리 듣기도 전에 쏘는 사람'],
  [240, '먼저 보면 먼저 쏜다. 교전 승률 보장'],
  [270, '평균 이상! 1:1은 자신 있는 편'],
  [300, '딱 평균. 이제부터는 에임 싸움'],
  [330, '한 박자 늦게 돌아보는 타입'],
  [360, '맞고 나서 "어디서 쏨?" 하는 타입'],
  [390, '자기장 맞으면서도 여유로운 타입'],
];
const SLOWEST_VERDICT = '혹시 지금 밥 먹으면서 하세요? 🍚';

export function verdict(avg: number): string {
  return VERDICTS.find(([below]) => avg < below)?.[1] ?? SLOWEST_VERDICT;
}

export function average(times: number[]): number {
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
}

/**
 * 매크로 거르기(③). 억울한 사람이 안 나오게 빡빡하게만 잡는다(2026-11-16 사용자 결정).
 *   - 5회 표준편차 4ms 미만 = 거의 복사한 기록(5→4ms, 2026-11-16 — 151·147·157·154·157 처럼 사람이 낸 4.3ms 가 걸려서). 꾸준한 사람(±15ms)도 우연히 걸릴 확률 약 0.9%.
 *   - 5회 평균 130ms 미만 = 브라우저 지연까지 낀 상태에서 사람이 내기 어려운 속도.
 */
export const MIN_AVG_MS = 130;
export const MIN_SPREAD_MS = 4;

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
