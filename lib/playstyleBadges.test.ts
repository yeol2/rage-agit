import { describe, expect, it } from 'vitest';
import {
  MIN_DBNOS_FOR_PLAYSTYLE_BADGE,
  MIN_GAMES_FOR_PLAYSTYLE_BADGE,
  MIN_KILLS_FOR_PLAYSTYLE_BADGE,
  badgesByMember,
  pickPlaystyleBadges,
  type PlaystyleStatsRow,
} from './playstyleBadges';

function row(over: Partial<PlaystyleStatsRow> & { memberId: string }): PlaystyleStatsRow {
  return {
    gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE,
    totalKills: 40,
    totalDbnos: 40,
    totalDamage: 12000, // 킬당 300
    ...over,
  };
}

function holderOf(rows: PlaystyleStatsRow[], kind: string): string | undefined {
  return pickPlaystyleBadges(rows).find((h) => h.kind === kind)?.memberId;
}

describe('pickPlaystyleBadges', () => {
  const rows = [
    // 킬당 600 — 딜은 제일 많이 넣는데 킬로 못 바꾼다
    row({ memberId: 'dealer', totalKills: 20, totalDamage: 12000 }),
    // 킬당 150 — 적은 딜로 킬만 챙긴다
    row({ memberId: 'killer', totalKills: 80, totalDamage: 12000 }),
    row({ memberId: 'plain' }),
    // 100번 눕혀놓고 킬은 20 — 기절당 0.2
    row({ memberId: 'hollow', totalKills: 20, totalDbnos: 100, totalDamage: 8000 }),
  ];

  it('킬당 딜량의 양 끝에 딜딸러와 킬딸러를 준다', () => {
    expect(holderOf(rows, 'damageFarmer')).toBe('dealer');
    expect(holderOf(rows, 'killFarmer')).toBe('killer');
  });

  it('기절당 킬이 가장 낮은 사람이 실속 없는 사람이다', () => {
    expect(holderOf(rows, 'hollow')).toBe('hollow');
  });

  it('경기 수가 모자란 사람은 아무리 극단적이어도 후보가 아니다', () => {
    const rookie = row({
      memberId: 'rookie',
      gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE - 1,
      totalKills: 30,
      totalDamage: 270000, // 킬당 9000 — 뽑히면 이 사람이 1등이다
    });
    expect(holderOf([...rows, rookie], 'damageFarmer')).toBe('dealer');
  });

  it('통산 킬이 얼마 없으면 킬당 딜량 뱃지에서 뺀다', () => {
    // 실측에서 16경기 4킬인 사람이 킬당 602로 1등이었다. 킬이 한 자리면 그건
    // 스타일이 아니라 한두 판의 운이다.
    const lucky = row({
      memberId: 'lucky',
      totalKills: MIN_KILLS_FOR_PLAYSTYLE_BADGE - 1,
      totalDamage: 90000,
    });
    expect(holderOf([...rows, lucky], 'damageFarmer')).toBe('dealer');

    const silent = row({ memberId: 'silent', totalKills: 0, totalDamage: 3000 });
    expect(holderOf([...rows, silent], 'damageFarmer')).toBe('dealer');
    expect(holderOf([...rows, silent], 'killFarmer')).toBe('killer');
  });

  it('기절이 얼마 없으면 실속 뱃지에서 뺀다', () => {
    const rare = row({
      memberId: 'rare',
      totalKills: 0,
      totalDbnos: MIN_DBNOS_FOR_PLAYSTYLE_BADGE - 1,
    });
    expect(holderOf([...rows, rare], 'hollow')).toBe('hollow');
  });

  it('동점이면 표본이 많은 쪽이 가져간다', () => {
    const veteran = row({
      memberId: 'zz-veteran',
      gameCount: MIN_GAMES_FOR_PLAYSTYLE_BADGE * 3,
      totalKills: 60,
      totalDamage: 36000, // 킬당 600 — dealer 와 같은 값
    });
    expect(holderOf([...rows, veteran], 'damageFarmer')).toBe('zz-veteran');
  });

  it('후보가 아무도 없으면 그 뱃지는 주인이 없다', () => {
    expect(pickPlaystyleBadges([])).toEqual([]);
  });

  it('한 사람이 두 뱃지를 같이 달 수 있다', () => {
    // 적은 딜로 킬을 챙기면서(킬딸러) 눕힌 것 대비 킬은 적을 수 있다.
    const both = [
      row({ memberId: 'a', totalKills: 80, totalDbnos: 400, totalDamage: 8000 }),
      row({ memberId: 'b', totalKills: 20, totalDamage: 12000 }),
    ];
    const byMember = badgesByMember(pickPlaystyleBadges(both));
    expect(byMember.get('a')?.map((h) => h.kind).sort()).toEqual(['hollow', 'killFarmer']);
    expect(byMember.get('b')?.map((h) => h.kind)).toEqual(['damageFarmer']);
  });
});
