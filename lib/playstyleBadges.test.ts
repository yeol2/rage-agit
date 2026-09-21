import { describe, expect, it } from 'vitest';
import {
  MIN_GAMES_FOR_PLAYSTYLE_BADGE,
  badgesByMember,
  damagePerKillOf,
  pickPlaystyleBadges,
  type PlaystyleStatsRow,
} from './playstyleBadges';

function row(over: Partial<PlaystyleStatsRow> & { memberId: string }): PlaystyleStatsRow {
  return {
    tier: 3,
    gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE,
    totalKills: 40,
    totalDamage: 8000, // 킬당 200
    ...over,
  };
}

// 기준선을 킬당 200딜로 만드는 평범한 사람들. 여기에 극단적인 사람을 섞어서
// 누가 뽑히는지 본다.
const crowd = Array.from({ length: 8 }, (_, i) => row({ memberId: `plain-${i}` }));

const kindsOf = (rows: PlaystyleStatsRow[], kind: string) =>
  pickPlaystyleBadges(rows)
    .filter((h) => h.kind === kind)
    .map((h) => `${h.medal}:${h.memberId}`);

describe('damagePerKillOf', () => {
  it('합계 대 합계로 기준선을 만든다', () => {
    expect(damagePerKillOf(crowd)).toBeCloseTo(200, 5);
  });
});

describe('pickPlaystyleBadges', () => {
  it('딜딸러는 킬 수로 기대되는 딜보다 많이 넣은 순으로 금·은·동', () => {
    // 킬은 같고 딜만 더 넣는다 — 기대(40킬 × 200 = 8000)보다 초과분이 큰 순서.
    const rows = [
      ...crowd,
      row({ memberId: 'most', totalDamage: 14000 }),
      row({ memberId: 'more', totalDamage: 12000 }),
      row({ memberId: 'bit', totalDamage: 10000 }),
    ];
    expect(kindsOf(rows, 'damageFarmer')).toEqual(['1:most', '2:more', '3:bit']);
  });

  it('킬딸러는 딜 양으로 기대되는 킬보다 많이 챙긴 순으로 금·은·동', () => {
    const rows = [
      ...crowd,
      row({ memberId: 'sniper', totalKills: 70 }), // 같은 딜로 킬이 더 많다
      row({ memberId: 'mid', totalKills: 60 }),
      row({ memberId: 'slight', totalKills: 50 }),
    ];
    expect(kindsOf(rows, 'killFarmer')).toEqual(['1:sniper', '2:mid', '3:slight']);
  });

  it('딜도 킬도 많은 사람이라도 기준에 맞으면 받는다', () => {
    // "킬에 비해 딜을 많이 쳤다"가 정의의 전부다. 잘하는 사람을 막으려고
    // 반대쪽 조건(킬이 중앙값 이하 같은)을 걸지 않는다.
    const rows = [...crowd, row({ memberId: 'ace', totalKills: 80, totalDamage: 20000 })];
    expect(kindsOf(rows, 'damageFarmer')[0]).toBe('1:ace');
  });

  it('딜딸러와 킬딸러는 한 값의 양 끝이라 한 사람이 둘 다 달 수 없다', () => {
    const rows = [...crowd, row({ memberId: 'x', totalDamage: 16000 })];
    const mine = badgesByMember(pickPlaystyleBadges(rows)).get('x') ?? [];
    const kinds = mine.map((h) => h.kind);
    expect(kinds).toContain('damageFarmer');
    expect(kinds).not.toContain('killFarmer');
  });

  it('티어 그룹마다 따로 뽑고, 기준선도 그룹 안에서 다시 잡는다', () => {
    // 두 그룹이 서로 다른 "보통"을 갖는다 — 0~1.5 는 킬당 400딜이 보통이라
    // 킬당 300딜인 사람은 딜이 오히려 모자라지만, 3~3.5 에서는 딜딸러다.
    const rich = Array.from({ length: 4 }, (_, i) =>
      row({ memberId: `rich-${i}`, tier: 1, totalDamage: 16000 }),
    );
    const rows = [
      ...crowd, // 3티어, 킬당 200
      ...rich, // 1티어, 킬당 400
      row({ memberId: 'mid-rich', tier: 1, totalDamage: 12000 }), // 킬당 300
      row({ memberId: 'mid-poor', tier: 3, totalDamage: 12000 }), // 킬당 300
    ];
    const holders = pickPlaystyleBadges(rows).filter((h) => h.kind === 'damageFarmer');
    expect(holders.find((h) => h.memberId === 'mid-poor')?.groupLabel).toBe('3~3.5티어');
    expect(holders.map((h) => h.memberId)).not.toContain('mid-rich');
  });

  it('경기 수가 모자라면 아무리 극단적이어도 후보가 아니다', () => {
    const rookie = row({
      memberId: 'rookie',
      gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE - 1,
      totalDamage: 99999,
    });
    expect(pickPlaystyleBadges([...crowd, rookie]).map((h) => h.memberId)).not.toContain('rookie');
  });

  it('통산 킬이 적어도 후보에서 빼지 않는다', () => {
    // 킬 하한을 뒀다가 뺐다 — "킬에 비해 딜을 많이 쳤다"에 킬이 몇 개 이상이어야
    // 한다는 조건은 없다. 킬이 거의 없으면 초과딜이 사실상 총딜이 된다.
    const rows = [...crowd, row({ memberId: 'no-kills', totalKills: 2, totalDamage: 6000 })];
    expect(kindsOf(rows, 'damageFarmer')[0]).toBe('1:no-kills');
  });

  it('기준선을 안 벗어난 사람에게는 메달을 안 준다', () => {
    // 후보가 적은 그룹에서 이게 없으면 "기대보다 오히려 모자란" 사람이 동메달을
    // 받는다(실측: 0~1.5티어 킬딸러 동메달 −0.05킬).
    const rows = [...crowd, row({ memberId: 'over', totalDamage: 12000 })];
    expect(kindsOf(rows, 'damageFarmer')).toEqual(['1:over']);
  });

  it('후보가 아무도 없으면 아무 뱃지도 안 준다', () => {
    expect(pickPlaystyleBadges([])).toEqual([]);
  });

  it('값이 같으면 표본이 많은 쪽이 위다', () => {
    const rows = [
      ...crowd,
      row({
        memberId: 'veteran',
        gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE * 3,
        totalKills: 120,
        totalDamage: 36000,
      }),
      row({ memberId: 'rookie-ish', totalKills: 40, totalDamage: 12000 }),
    ];
    // 둘 다 기대보다 경기당 같은 만큼(+250딜) 더 넣었다.
    expect(kindsOf(rows, 'damageFarmer')[0]).toBe('1:veteran');
  });
});
