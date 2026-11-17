import { describe, expect, it } from 'vitest';
import {
  AFTER_FAKE_GAP_MAX_MS,
  COMMENT_MAX_CHARS,
  AFTER_FAKE_GAP_MIN_MS,
  FAKE_SHOW_MAX_MS,
  FAKE_SHOW_MIN_MS,
  REACTION_ROUNDS,
  normalizeComment,
  planFakeRounds,
  roundTimeline,
  spread,
  suspiciousReason,
  verdict,
} from './reaction';

describe('suspiciousReason', () => {
  it('lets ordinary human runs through', () => {
    expect(suspiciousReason([241, 268, 225, 290, 252])).toBeNull();
    // 아주 꾸준한 사람(편차 약 6ms)도 통과.
    expect(suspiciousReason([230, 238, 226, 233, 241])).toBeNull();
    // 실제로 사람이 낸 기록(편차 약 4.3ms) — 5ms 기준일 땐 매크로로 걸렸다.
    expect(suspiciousReason([151, 147, 157, 154, 157])).toBeNull();
  });

  it('flags near-identical runs as a macro', () => {
    expect(spread([230, 230, 231, 228, 234])).toBeLessThan(4);
    expect(suspiciousReason([230, 230, 231, 228, 234])).toMatch(/매크로/);
  });

  it('flags averages under 130ms', () => {
    expect(suspiciousReason([110, 125, 140, 118, 132])).toMatch(/130ms/);
  });
});

describe('normalizeComment', () => {
  it('treats empty or non-string input as no comment', () => {
    expect(normalizeComment(undefined)).toBeNull();
    expect(normalizeComment('')).toBeNull();
    expect(normalizeComment('   \n ')).toBeNull();
  });

  it('collapses line breaks and extra spaces into one line', () => {
    expect(normalizeComment('  초록불\n\n  보고   눌렀다 ')).toBe('초록불 보고 눌렀다');
  });

  it('allows exactly 30 characters, counting Korean and emoji as one each', () => {
    expect(COMMENT_MAX_CHARS).toBe(30);
    expect(normalizeComment('가'.repeat(30))).toBe('가'.repeat(30));
    expect(normalizeComment('🔥'.repeat(30))).toBe('🔥'.repeat(30));
    expect(normalizeComment('가'.repeat(31))).toBe('too-long');
  });
});

const sum = (plan: number[]) => plan.reduce((a, b) => a + b, 0);

describe('planFakeRounds', () => {
  it('never gives a run without a yellow', () => {
    for (let i = 0; i < 5000; i++) expect(sum(planFakeRounds())).toBeGreaterThanOrEqual(1);
  });

  it('still guarantees exactly one yellow even when the chance is 0', () => {
    for (let i = 0; i < 200; i++) {
      const plan = planFakeRounds(0);
      expect(plan).toHaveLength(REACTION_ROUNDS);
      expect(sum(plan)).toBe(1);
    }
  });

  it('gives every round the same chance of a yellow (~33% once empty runs are redrawn)', () => {
    const N = 20000;
    const hits = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) planFakeRounds().forEach((n, r) => n > 0 && hits[r]++);
    for (const h of hits) {
      expect(h / N).toBeGreaterThan(0.30);
      expect(h / N).toBeLessThan(0.36);
    }
  });

  it('never puts more than 5 yellows in a row in one round', () => {
    for (let i = 0; i < 2000; i++) expect(Math.max(...planFakeRounds(0.99))).toBeLessThanOrEqual(5);
  });

  it('can chain two yellows in one round and in back-to-back rounds', () => {
    const plans = Array.from({ length: 2000 }, () => planFakeRounds());
    expect(plans.some((plan) => plan.some((n) => n >= 2))).toBe(true);
    expect(plans.some((plan) => plan.some((n, i) => n > 0 && plan[i + 1] > 0))).toBe(true);
  });
});

describe('roundTimeline', () => {
  it('shows green at the first wait when there is no yellow', () => {
    expect(roundTimeline(2000, 0)).toEqual({ fakes: [], goAt: 2000 });
  });

  it('keeps every yellow on for at least 1s and waits at least 1s before the next light', () => {
    for (let i = 0; i < 500; i++) {
      const { fakes, goAt } = roundTimeline(2000, 3);
      expect(fakes[0].on).toBe(2000);
      fakes.forEach((fake, k) => {
        const shown = fake.off - fake.on;
        expect(shown).toBeGreaterThanOrEqual(FAKE_SHOW_MIN_MS);
        expect(shown).toBeLessThanOrEqual(FAKE_SHOW_MAX_MS);
        const next = k + 1 < fakes.length ? fakes[k + 1].on : goAt;
        expect(next - fake.off).toBeGreaterThanOrEqual(AFTER_FAKE_GAP_MIN_MS);
        expect(next - fake.off).toBeLessThanOrEqual(AFTER_FAKE_GAP_MAX_MS);
      });
    }
  });

  it('does not put the next light at a fixed time after a yellow (no pre-timing)', () => {
    const gaps = new Set(Array.from({ length: 50 }, () => {
      const { fakes, goAt } = roundTimeline(2000, 1);
      return Math.round(goAt - fakes[0].off);
    }));
    expect(gaps.size).toBeGreaterThan(10);
  });
});

describe('verdict', () => {
  it('splits averages into 30ms bands with the agreed lines', () => {
    expect(verdict(149)).toBe('WOW.. 매크로시죠? 의심할께요');
    expect(verdict(150)).toBe('에임봇 의심됨. 핵 검사 받으러 가실게요');
    expect(verdict(179)).toBe('에임봇 의심됨. 핵 검사 받으러 가실게요');
    expect(verdict(180)).toBe('발자국 소리 듣기도 전에 쏘는 사람');
    expect(verdict(270)).toBe('딱 평균. 이제부터는 에임 싸움');
    expect(verdict(389)).toBe('자기장 맞으면서도 여유로운 타입');
    expect(verdict(390)).toBe('혹시 지금 밥 먹으면서 하세요? 🍚');
  });

  it('gives each 30ms band its own line (10 lines in all)', () => {
    const lines = new Set([140, 160, 190, 220, 250, 280, 310, 340, 370, 400].map(verdict));
    expect(lines.size).toBe(10);
  });
});
