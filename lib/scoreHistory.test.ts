import { describe, expect, it } from 'vitest';
import { carrySeries, computeScoreHistory, type RankedGame } from './scoreHistory';
import { RAGE_SCORE_STEEPNESS, TIER_SCORE_BANDS, eligibleForRanking, rageScores } from './rankingStats';

// 같은 밴드(2티어) 세 명이 내전 5회(경기 4개씩)를 치른다. 자격은 통산 16경기라
// 4회차부터 점수가 생긴다. C 는 5회차에 쉰다.
const DATES = ['2026-10-01', '2026-10-04', '2026-10-08', '2026-10-11', '2026-10-15'];
const MEMBERS = [
  { id: 'A', tier: 2 },
  { id: 'B', tier: 2 },
  { id: 'C', tier: 2 },
];

function scrim(date: string, who: Record<string, [kills: number, rank: number]>): RankedGame[] {
  return [0, 1, 2, 3].flatMap((round) =>
    Object.entries(who).map(([memberId, [kills, teamRank]]) => ({
      memberId,
      kills,
      teamRank,
      // 20:00 KST 부터 라운드마다 15분 — UTC 로는 11시대다.
      playedAt: `${date}T11:${String(round * 15).padStart(2, '0')}:00.000Z`,
    })),
  );
}

const GAMES: RankedGame[] = [
  ...scrim(DATES[0], { A: [3, 1], B: [1, 8], C: [2, 4] }),
  ...scrim(DATES[1], { A: [2, 2], B: [1, 6], C: [2, 5] }),
  ...scrim(DATES[2], { A: [4, 1], B: [0, 10], C: [1, 3] }),
  ...scrim(DATES[3], { A: [1, 5], B: [2, 4], C: [3, 2] }),
  ...scrim(DATES[4], { A: [0, 12], B: [5, 1] }),
];

describe('computeScoreHistory', () => {
  const history = computeScoreHistory(GAMES, MEMBERS);

  it('점수에 센 내전 날짜를 오래된 순으로 낸다', () => {
    expect(history.dates).toEqual(DATES);
  });

  it('자격(통산 16경기)이 생긴 날부터, 자기가 뛴 날만 점수를 남긴다', () => {
    expect(history.byMember.A.map((p) => p.date)).toEqual([DATES[3], DATES[4]]);
    // C 는 5회차에 안 뛰었으므로 그날 점은 없다(그래프에서 이어 그린다).
    expect(history.byMember.C.map((p) => p.date)).toEqual([DATES[3]]);
  });

  it('그날 점수는 그날까지의 경기만으로 리더보드 공식을 돌린 값과 같다', () => {
    // 4회차까지 경기만 가지고 리더보드처럼 계산한 값.
    const upTo = GAMES.filter((g) => g.playedAt < '2026-10-12');
    const rows = MEMBERS.map((m) => {
      const mine = upTo.filter((g) => g.memberId === m.id);
      const pp = (r: number) => ({ 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 })[r] ?? 0;
      return {
        memberId: m.id,
        discordNickname: '',
        tier: m.tier,
        totalGameCount: mine.length,
        windowGameCount: mine.length,
        avgKills: mine.reduce((s, g) => s + g.kills, 0) / mine.length,
        avgPlacementPoints: mine.reduce((s, g) => s + pp(g.teamRank), 0) / mine.length,
        avgRank: mine.reduce((s, g) => s + g.teamRank, 0) / mine.length,
        lastPlayedAt: mine[mine.length - 1].playedAt,
        winCount: 0,
        crabKingCount: 0,
      };
    });
    const expected = new Map(
      rageScores(eligibleForRanking(rows, new Date('2026-10-12T00:00:00+09:00')), TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS).map(
        (r) => [r.memberId, r.score],
      ),
    );
    for (const id of ['A', 'B', 'C']) {
      expect(history.byMember[id][0].alltime).toBeCloseTo(expected.get(id)!, 10);
    }
  });

  it('최근 창은 최근 16경기만 본다 — 5회차에 크게 진 A 는 최근 점수가 더 많이 떨어진다', () => {
    const [before, after] = history.byMember.A;
    expect(after.recent16 - before.recent16).toBeLessThan(after.alltime - before.alltime);
  });

  it('활동 중이 아닌 사람(명단에 없는 id)은 계산에서 뺀다', () => {
    const withGhost = computeScoreHistory(
      [...GAMES, ...scrim(DATES[0], { GHOST: [9, 1] })],
      MEMBERS,
    );
    expect(withGhost.byMember.GHOST).toBeUndefined();
    expect(withGhost.byMember.A).toEqual(history.byMember.A);
  });
});

describe('carrySeries', () => {
  const points = [
    { date: '2026-10-04', alltime: 50, recent16: 55 },
    { date: '2026-10-11', alltime: 60, recent16: 70 },
  ];

  it('첫 점수 전 날짜는 빼고, 안 뛴 날은 직전 점수를 그대로 잇는다', () => {
    expect(carrySeries(DATES, points)).toEqual([
      { date: '2026-10-04', alltime: 50, recent16: 55, played: true },
      { date: '2026-10-08', alltime: 50, recent16: 55, played: false },
      { date: '2026-10-11', alltime: 60, recent16: 70, played: true },
      { date: '2026-10-15', alltime: 60, recent16: 70, played: false },
    ]);
  });

  it('점수가 하나도 없으면 빈 배열', () => {
    expect(carrySeries(DATES, [])).toEqual([]);
  });
});
