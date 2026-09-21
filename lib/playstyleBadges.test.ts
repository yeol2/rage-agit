import { describe, expect, it } from 'vitest';
import {
  MIN_DBNOS_FOR_PLAYSTYLE_BADGE,
  MIN_GAMES_FOR_PLAYSTYLE_BADGE,
  MIN_KILLS_FOR_PLAYSTYLE_BADGE,
  badgesByMember,
  clanBaseline,
  pickPlaystyleBadges,
  type PlaystyleStatsRow,
} from './playstyleBadges';

function row(over: Partial<PlaystyleStatsRow> & { memberId: string }): PlaystyleStatsRow {
  return {
    gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE,
    totalKills: 40,
    totalDbnos: 40,
    totalDamage: 8000, // 킬당 200
    ...over,
  };
}

// 기준선을 200딜/킬, 1.00킬/기절로 만드는 평범한 사람들. 여기에 극단적인
// 사람을 한둘 섞어서 누가 뽑히는지 본다.
const crowd = Array.from({ length: 8 }, (_, i) => row({ memberId: `plain-${i}` }));

const kindsOf = (rows: PlaystyleStatsRow[], kind: string) =>
  pickPlaystyleBadges(rows)
    .filter((h) => h.kind === kind)
    .map((h) => `${h.medal}:${h.memberId}`);

describe('clanBaseline', () => {
  it('합계 대 합계로 기준선을 만든다', () => {
    const base = clanBaseline(crowd);
    expect(base.damagePerKill).toBeCloseTo(200, 5);
    expect(base.killsPerDbno).toBeCloseTo(1, 5);
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

  it('실속 없는 사람은 기절 대비 킬이 모자란 순으로 금·은·동', () => {
    const rows = [
      ...crowd,
      row({ memberId: 'worst', totalDbnos: 80 }), // 40킬인데 80번 눕힘
      row({ memberId: 'bad', totalDbnos: 70 }),
      row({ memberId: 'meh', totalDbnos: 60 }),
    ];
    expect(kindsOf(rows, 'hollow')).toEqual(['1:worst', '2:bad', '3:meh']);
  });

  it('딜은 적은데 킬이 더 적은 사람은 딜딸러가 아니다', () => {
    // 비율(킬당 딜량)로 뽑던 시절의 1위가 이런 사람이었다 — 딜 하위권인데
    // 킬이 더 없어서 비율만 컸다. 경기당 절대량으로 재면 올라오지 못한다.
    const rows = [
      ...crowd,
      row({ memberId: 'quiet', totalKills: 20, totalDamage: 5000 }), // 킬당 250
      row({ memberId: 'loud', totalDamage: 12000 }), // 킬당 300, 딜도 많다
    ];
    expect(kindsOf(rows, 'damageFarmer')[0]).toBe('1:loud');
    expect(kindsOf(rows, 'damageFarmer')).not.toContain('1:quiet');
  });

  it('딜딸러와 킬딸러는 한 값의 양 끝이라 한 사람이 둘 다 달 수 없다', () => {
    const rows = [...crowd, row({ memberId: 'x', totalDamage: 16000 })];
    const mine = badgesByMember(pickPlaystyleBadges(rows)).get('x') ?? [];
    const kinds = mine.map((h) => h.kind);
    expect(kinds).toContain('damageFarmer');
    expect(kinds).not.toContain('killFarmer');
  });

  it('표본이 모자라면 아무리 극단적이어도 후보가 아니다', () => {
    const rookie = row({
      memberId: 'rookie',
      gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE - 1,
      totalDamage: 99999,
    });
    const fewKills = row({
      memberId: 'few-kills',
      totalKills: MIN_KILLS_FOR_PLAYSTYLE_BADGE - 1,
      totalDamage: 99999,
    });
    const fewKnocks = row({
      memberId: 'few-knocks',
      totalDbnos: MIN_DBNOS_FOR_PLAYSTYLE_BADGE - 1,
      totalKills: 1,
    });
    const rows = [...crowd, rookie, fewKills, fewKnocks];
    const everyone = pickPlaystyleBadges(rows).map((h) => h.memberId);
    expect(everyone).not.toContain('rookie');
    expect(everyone).not.toContain('few-kills');
    expect(everyone).not.toContain('few-knocks');
  });

  it('딜도 킬도 최상위인 에이스는 킬딸러가 아니다', () => {
    // 가드가 없던 판에서는 클랜 킬 1위·딜 2위인 사람이 킬딸러 금메달이었다.
    // 딜이 중앙값 이하여야 한다는 조건이 그걸 막는다.
    const rows = [
      ...crowd,
      row({ memberId: 'ace', totalKills: 90, totalDamage: 16000 }), // 딜도 킬도 최상위
      row({ memberId: 'cheap', totalKills: 50, totalDamage: 6000 }), // 적은 딜로 킬
    ];
    const winners = kindsOf(rows, 'killFarmer');
    expect(winners[0]).toBe('1:cheap');
    expect(winners.join(' ')).not.toContain('ace');
  });

  it('눕히기를 별로 안 하는 사람은 실속 뱃지 후보가 아니다', () => {
    const rows = [
      ...crowd,
      row({ memberId: 'quiet', totalKills: 20, totalDbnos: 25 }), // 기절 자체가 적다
      row({ memberId: 'busy', totalKills: 40, totalDbnos: 70 }), // 많이 눕히고 못 끝냄
    ];
    expect(kindsOf(rows, 'hollow')[0]).toBe('1:busy');
  });

  it('후보가 셋보다 적으면 있는 만큼만 준다', () => {
    const two = [row({ memberId: 'a' }), row({ memberId: 'b', totalDamage: 9000 })];
    expect(kindsOf(two, 'damageFarmer')).toHaveLength(2);
  });

  it('후보가 아무도 없으면 아무 뱃지도 안 준다', () => {
    expect(pickPlaystyleBadges([])).toEqual([]);
  });

  it('값이 같으면 표본이 많은 쪽이 위다', () => {
    const rows = [
      ...crowd,
      row({ memberId: 'veteran', gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE * 3, totalKills: 120, totalDbnos: 120, totalDamage: 36000 }),
      row({ memberId: 'rookie-ish', totalKills: 40, totalDbnos: 40, totalDamage: 12000 }),
    ];
    // 둘 다 기대보다 경기당 같은 만큼(+250딜) 더 넣었다.
    expect(kindsOf(rows, 'damageFarmer')[0]).toBe('1:veteran');
  });
});
