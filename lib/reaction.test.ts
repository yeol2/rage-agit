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
} from './reaction';

describe('suspiciousReason', () => {
  it('lets ordinary human runs through', () => {
    expect(suspiciousReason([241, 268, 225, 290, 252])).toBeNull();
    // 아주 꾸준한 사람(편차 약 6ms)도 통과.
    expect(suspiciousReason([230, 238, 226, 233, 241])).toBeNull();
  });

  it('flags near-identical runs as a macro', () => {
    expect(spread([230, 230, 231, 228, 234])).toBeLessThan(5);
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
  it('has no guaranteed yellow — chance 0 gives none', () => {
    for (let i = 0; i < 200; i++) {
      const plan = planFakeRounds(0);
      expect(plan).toHaveLength(REACTION_ROUNDS);
      expect(sum(plan)).toBe(0);
    }
  });

  it('gives every round the same ~15% chance of a yellow', () => {
    const N = 20000;
    const hits = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) planFakeRounds().forEach((n, r) => n > 0 && hits[r]++);
    for (const h of hits) {
      expect(h / N).toBeGreaterThan(0.13);
      expect(h / N).toBeLessThan(0.17);
    }
  });

  it('can give a run with no yellow at all (about 44%)', () => {
    const runs = Array.from({ length: 5000 }, () => sum(planFakeRounds()));
    const share = runs.filter((n) => n === 0).length / runs.length;
    expect(share).toBeGreaterThan(0.40);
    expect(share).toBeLessThan(0.48);
  });

  it('never puts more than 3 yellows in one round', () => {
    for (let i = 0; i < 2000; i++) expect(Math.max(...planFakeRounds(0.99))).toBeLessThanOrEqual(3);
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
