import { describe, expect, it } from 'vitest';
import { pickPartners, type PartnerStat } from './partnerStats';

function stat(partial: Partial<PartnerStat> & { partnerId: string; rankDelta: number }): PartnerStat {
  return {
    gamesTogether: 8,
    avgRankTogether: 8 - partial.rankDelta,
    avgRankApart: 8,
    ...partial,
  };
}

describe('pickPartners', () => {
  it('차이가 가장 큰 쪽이 깐부, 가장 작은 쪽이 사대가 안 맞는 사람이다', () => {
    const { best, worst } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 1.2 }),
      stat({ partnerId: 'b', rankDelta: 3.4 }),
      stat({ partnerId: 'c', rankDelta: -2.5 }),
      stat({ partnerId: 'd', rankDelta: -0.3 }),
    ]);
    expect(best?.partnerId).toBe('b');
    expect(worst?.partnerId).toBe('c');
  });

  it('차이가 같으면 더 많이 함께한 쪽이 이긴다 — 표본이 두꺼운 쪽이 덜 우연이다', () => {
    const { best, worst } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 2, gamesTogether: 8 }),
      stat({ partnerId: 'b', rankDelta: 2, gamesTogether: 16 }),
      stat({ partnerId: 'c', rankDelta: -2, gamesTogether: 8 }),
      stat({ partnerId: 'd', rankDelta: -2, gamesTogether: 12 }),
    ]);
    expect(best?.partnerId).toBe('b');
    expect(worst?.partnerId).toBe('d');
  });

  it('후보가 한 명이면 부호가 가리키는 쪽에만 앉는다 — 같이 하면 좋아지면서 나빠질 수는 없다', () => {
    const onlyGood = pickPartners([stat({ partnerId: 'a', rankDelta: 1.5 })]);
    expect(onlyGood.best?.partnerId).toBe('a');
    expect(onlyGood.worst).toBeNull();

    const onlyBad = pickPartners([stat({ partnerId: 'a', rankDelta: -1.5 })]);
    expect(onlyBad.best).toBeNull();
    expect(onlyBad.worst?.partnerId).toBe('a');
  });

  it('차이가 정확히 0이면 어느 쪽에도 앉히지 않는다', () => {
    expect(pickPartners([stat({ partnerId: 'a', rankDelta: 0 })])).toEqual({
      best: null,
      worst: null,
    });
  });

  it('후보가 없으면 양쪽 다 null 이다', () => {
    expect(pickPartners([])).toEqual({ best: null, worst: null });
  });
});
