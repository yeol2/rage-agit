import { describe, expect, it } from 'vitest';
import { pickPartners, type PartnerStat } from './partnerStats';

function stat(
  partial: Partial<PartnerStat> & { partnerId: string; rankDelta: number },
): PartnerStat {
  return {
    sessionsTogether: 2,
    gamesTogether: 8,
    avgRankTogether: 8 - partial.rankDelta,
    avgRankApart: 8,
    ...partial,
  };
}

function ids(rows: PartnerStat[]): string[] {
  return rows.map((row) => row.partnerId);
}

describe('pickPartners', () => {
  it('차이가 가장 큰 쪽이 깐부, 가장 작은 쪽이 다시는 보지 말자다', () => {
    const { best, worst } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 1.2 }),
      stat({ partnerId: 'b', rankDelta: 3.4 }),
      stat({ partnerId: 'c', rankDelta: -2.5 }),
      stat({ partnerId: 'd', rankDelta: -0.3 }),
    ]);
    expect(ids(best)).toEqual(['b']);
    expect(ids(worst)).toEqual(['c']);
  });

  it('동률이면 전원을 세운다 — 화면에 같은 숫자가 찍히는 사람은 다 나온다', () => {
    const { best, worst } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 3.0 }),
      stat({ partnerId: 'b', rankDelta: 3.0 }),
      stat({ partnerId: 'c', rankDelta: 1.0 }),
      stat({ partnerId: 'd', rankDelta: -2.0 }),
      stat({ partnerId: 'e', rankDelta: -2.0 }),
    ]);
    expect(ids(best).sort()).toEqual(['a', 'b']);
    expect(ids(worst).sort()).toEqual(['d', 'e']);
  });

  it('반올림해서 같은 숫자가 되면 동률이다 — 3.44 와 3.35 는 둘 다 3.4등으로 찍힌다', () => {
    const { best } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 3.44 }),
      stat({ partnerId: 'b', rankDelta: 3.35 }),
      stat({ partnerId: 'c', rankDelta: 3.34 }),
    ]);
    expect(ids(best).sort()).toEqual(['a', 'b']);
  });

  // 2회짜리는 차이의 절반만 남고 6회짜리는 4분의 3이 남는다:
  // 3.0 × 2/4 = 1.5 < 2.2 × 6/8 = 1.65.
  it('표본이 얇으면 차이를 깎아서 센다 — 두 번 만나 크게 튄 사람이 자동으로 이기지 않는다', () => {
    const { best } = pickPartners([
      stat({ partnerId: 'thin', rankDelta: 3.0, sessionsTogether: 2 }),
      stat({ partnerId: 'thick', rankDelta: 2.2, sessionsTogether: 6 }),
    ]);
    expect(ids(best)).toEqual(['thick']);
  });

  it('그래도 차이가 충분히 크면 얇은 표본이 이긴다', () => {
    const { best } = pickPartners([
      stat({ partnerId: 'thin', rankDelta: 6.0, sessionsTogether: 2 }),
      stat({ partnerId: 'thick', rankDelta: 2.2, sessionsTogether: 6 }),
    ]);
    expect(ids(best)).toEqual(['thin']);
  });

  it('나빠진 쪽도 같은 보정을 받는다', () => {
    const { worst } = pickPartners([
      stat({ partnerId: 'thin', rankDelta: -3.0, sessionsTogether: 2 }),
      stat({ partnerId: 'thick', rankDelta: -2.2, sessionsTogether: 6 }),
    ]);
    expect(ids(worst)).toEqual(['thick']);
  });

  // 화면에 적히는 차이는 보정 전 값이다 — 카드가 두 평균을 나란히 보여주므로
  // 그 둘의 차이와 다른 수가 적히면 안 된다.
  it('한 칸에 세우는 기준은 화면에 찍히는 숫자 그대로다', () => {
    const { best } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 2.2, sessionsTogether: 6 }),
      stat({ partnerId: 'b', rankDelta: 2.2, sessionsTogether: 2 }),
      stat({ partnerId: 'c', rankDelta: 2.1, sessionsTogether: 4 }),
    ]);
    expect(ids(best)).toEqual(['a', 'b']);
  });

  it('동률 안에서는 더 오래 함께한 사람이 위에 온다', () => {
    const { best } = pickPartners([
      stat({ partnerId: 'a', rankDelta: 2, sessionsTogether: 2 }),
      stat({ partnerId: 'b', rankDelta: 2, sessionsTogether: 5 }),
      stat({ partnerId: 'c', rankDelta: 2, sessionsTogether: 3 }),
    ]);
    expect(ids(best)).toEqual(['b', 'c', 'a']);
  });

  it('후보가 한 명이면 부호가 가리키는 쪽에만 선다 — 같이 하면 좋아지면서 나빠질 수는 없다', () => {
    const onlyGood = pickPartners([stat({ partnerId: 'a', rankDelta: 1.5 })]);
    expect(ids(onlyGood.best)).toEqual(['a']);
    expect(onlyGood.worst).toEqual([]);

    const onlyBad = pickPartners([stat({ partnerId: 'a', rankDelta: -1.5 })]);
    expect(onlyBad.best).toEqual([]);
    expect(ids(onlyBad.worst)).toEqual(['a']);
  });

  it('반올림하면 0.0등이 되는 사람은 어느 쪽에도 세우지 않는다', () => {
    expect(pickPartners([stat({ partnerId: 'a', rankDelta: 0.04 })])).toEqual({
      best: [],
      worst: [],
    });
    expect(pickPartners([stat({ partnerId: 'a', rankDelta: 0 })])).toEqual({
      best: [],
      worst: [],
    });
  });

  it('후보가 없으면 양쪽 다 빈 칸이다', () => {
    expect(pickPartners([])).toEqual({ best: [], worst: [] });
  });
});
