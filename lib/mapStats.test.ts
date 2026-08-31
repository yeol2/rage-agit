import { describe, expect, it } from 'vitest';
import { pickMapBadges, sortByScrimOrder, type MapStat } from './mapStats';

function stat(partial: Partial<MapStat> & { memberId: string; mapName: string }): MapStat {
  const rankDelta = partial.rankDelta ?? 0;
  return {
    label: partial.mapName,
    games: 8,
    avgRank: 8 - rankDelta,
    avgKills: 1,
    otherAvgRank: 8,
    ...partial,
    rankDelta,
  };
}

describe('sortByScrimOrder', () => {
  it('내전 라운드 순서대로 놓는다 — 사람들이 그날 겪은 순서다', () => {
    const rows = sortByScrimOrder([
      { mapName: 'Tiger_Main' },
      { mapName: 'Baltic_Main' },
      { mapName: 'Neon_Main' },
      { mapName: 'Desert_Main' },
    ]);
    expect(rows.map((r) => r.mapName)).toEqual([
      'Neon_Main',
      'Baltic_Main',
      'Desert_Main',
      'Tiger_Main',
    ]);
  });

  it('순서표에 없는 맵은 뒤에 붙인다 — 내전 구성이 바뀌어도 화면이 안 깨진다', () => {
    const rows = sortByScrimOrder([{ mapName: 'Savage_Main' }, { mapName: 'Neon_Main' }]);
    expect(rows.map((r) => r.mapName)).toEqual(['Neon_Main', 'Savage_Main']);
  });
});

describe('pickMapBadges', () => {
  it('맵마다 신 한 명, 똥 한 명을 뽑는다', () => {
    const badges = pickMapBadges([
      stat({ memberId: 'a', mapName: 'Neon_Main', rankDelta: 3 }),
      stat({ memberId: 'b', mapName: 'Neon_Main', rankDelta: 1 }),
      stat({ memberId: 'c', mapName: 'Neon_Main', rankDelta: -2 }),
    ]);

    expect(badges).toHaveLength(2);
    expect(badges.find((b) => b.kind === 'god')?.memberId).toBe('a');
    expect(badges.find((b) => b.kind === 'poop')?.memberId).toBe('c');
  });

  // 4경기 × 3.0 = 2.0 (보정 후) < 12경기 × 2.5 = 2.14.
  it('표본이 얇으면 차이를 깎아서 센다 — 적게 뛴 사람이 자동으로 신이 되지 않는다', () => {
    const badges = pickMapBadges([
      stat({ memberId: 'thin', mapName: 'Neon_Main', games: 4, rankDelta: 3.0 }),
      stat({ memberId: 'thick', mapName: 'Neon_Main', games: 12, rankDelta: 2.5 }),
    ]);
    expect(badges.find((b) => b.kind === 'god')?.memberId).toBe('thick');
  });

  it('자격(맵당 4경기) 미만은 후보가 아니다', () => {
    const badges = pickMapBadges([
      stat({ memberId: 'few', mapName: 'Neon_Main', games: 3, rankDelta: 9 }),
      stat({ memberId: 'ok', mapName: 'Neon_Main', games: 4, rankDelta: 1 }),
    ]);
    expect(badges.find((b) => b.kind === 'god')?.memberId).toBe('ok');
  });

  it('한 방향뿐이면 그쪽 뱃지만 나온다 — 잘하지도 못하지도 않았는데 똥을 주지 않는다', () => {
    const badges = pickMapBadges([stat({ memberId: 'a', mapName: 'Neon_Main', rankDelta: 2 })]);
    expect(badges.map((b) => b.kind)).toEqual(['god']);
  });

  it('반올림해서 0.0등이 되는 차이는 뱃지가 아니다', () => {
    expect(pickMapBadges([stat({ memberId: 'a', mapName: 'Neon_Main', rankDelta: 0.04 })])).toEqual([]);
  });

  it('한 사람이 어떤 맵의 신이면서 다른 맵의 똥일 수 있다', () => {
    const badges = pickMapBadges([
      stat({ memberId: 'daks', mapName: 'Neon_Main', rankDelta: 6 }),
      stat({ memberId: 'daks', mapName: 'Tiger_Main', rankDelta: -4 }),
    ]);
    expect(badges.map((b) => [b.mapName, b.kind])).toEqual([
      ['Neon_Main', 'god'],
      ['Tiger_Main', 'poop'],
    ]);
  });
});
