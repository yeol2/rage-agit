import { describe, expect, it } from 'vitest';
import { chunk, pickLightSeeds } from './polling.mjs';

// Players 응답을 본떠 만든다. 우리가 쓰는 건 id 와 매치 목록 길이뿐이다.
function makePlayer(accountId, matchCount) {
  return {
    id: accountId,
    attributes: { name: accountId.replace('account.', 'Ez_') },
    relationships: {
      matches: { data: Array.from({ length: matchCount }, (_, i) => ({ id: `${accountId}-m${i}` })) },
    },
  };
}

describe('pickLightSeeds', () => {
  it('매치가 적은 사람부터 고른다', () => {
    // 실측: 상위 20명 전원이 내전에 다 나왔지만 랭크 볼륨은 39~279 로 7배 차이났다.
    const players = [
      makePlayer('account.lapaz', 279),
      makePlayer('account.grim', 39),
      makePlayer('account.macho', 60),
      makePlayer('account.dane', 226),
    ];
    expect(pickLightSeeds(players, 2)).toEqual(['account.grim', 'account.macho']);
  });

  it('limit 이 인원보다 크면 전원을 돌려준다', () => {
    const players = [makePlayer('account.a', 10), makePlayer('account.b', 20)];
    expect(pickLightSeeds(players, 5)).toEqual(['account.a', 'account.b']);
  });

  it('빈 목록이면 빈 배열을 준다', () => {
    expect(pickLightSeeds([], 8)).toEqual([]);
  });

  it('매치 목록이 없는 플레이어도 다룬다', () => {
    const players = [{ id: 'account.new', relationships: {} }, makePlayer('account.a', 5)];
    expect(pickLightSeeds(players, 2)).toEqual(['account.new', 'account.a']);
  });
});

describe('chunk', () => {
  it('지정한 크기로 나눈다', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('빈 배열은 빈 배열을 준다', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
