import { describe, expect, it } from 'vitest';
import { REACTION_ROUNDS, planFakeRounds, spread, suspiciousReason } from './reaction';

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

describe('planFakeRounds', () => {
  it('always puts at least one fake in a run, even when the chance is 0', () => {
    for (let i = 0; i < 200; i++) {
      const plan = planFakeRounds(REACTION_ROUNDS, 0);
      expect(plan).toHaveLength(REACTION_ROUNDS);
      expect(plan.filter(Boolean)).toHaveLength(1);
    }
  });

  it('spreads the guaranteed fake across every round', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(planFakeRounds(REACTION_ROUNDS, 0).indexOf(true));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('can put fakes in back-to-back rounds', () => {
    const plans = Array.from({ length: 500 }, () => planFakeRounds());
    expect(plans.some((plan) => plan.some((fake, i) => fake && plan[i + 1]))).toBe(true);
  });
});
