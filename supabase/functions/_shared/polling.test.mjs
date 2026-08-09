import { describe, expect, it } from 'vitest';
import { chunk, pendingMatchIds, pickLightSeeds } from './polling.mjs';

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

describe('pendingMatchIds', () => {
  const refs = (...ids) => ids.map((id) => ({ type: 'match', id }));

  it('아직 안 살펴본 매치만 최신순 그대로 남긴다', () => {
    expect(pendingMatchIds(refs('m4', 'm3', 'm2', 'm1'), new Set(['m4', 'm3']))).toEqual([
      'm2',
      'm1',
    ]);
  });

  it('지난 실행에서 건너뛴 자리가 목록 아래에 있어도 남긴다', () => {
    // 이게 이 함수가 존재하는 이유다. 예전에는 '이미 본 매치를 만나면 멈춤'이었는데,
    // 조회 실패나 상한 초과로 중간을 건너뛰면 그 자리에 영영 도달하지 못했다.
    // m4/m3/m1 은 저장됐고 m2 만 실패한 상황.
    expect(pendingMatchIds(refs('m4', 'm3', 'm2', 'm1'), new Set(['m4', 'm3', 'm1']))).toEqual([
      'm2',
    ]);
  });

  it('전부 살펴봤으면 빈 배열을 준다', () => {
    expect(pendingMatchIds(refs('m2', 'm1'), new Set(['m2', 'm1']))).toEqual([]);
  });

  it('매치 목록이 없는 플레이어도 다룬다', () => {
    expect(pendingMatchIds(undefined, new Set())).toEqual([]);
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
