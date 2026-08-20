import { describe, expect, it } from 'vitest';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  placementPoints,
  type RosterMemberForScoring,
  type RoundParticipant,
  type TeamRoundResult,
} from './roundSheet';

describe('placementPoints', () => {
  it('0012 마이그레이션의 배치 점수표와 같은 값을 낸다', () => {
    expect(placementPoints(1)).toBe(10);
    expect(placementPoints(2)).toBe(6);
    expect(placementPoints(3)).toBe(5);
    expect(placementPoints(4)).toBe(4);
    expect(placementPoints(5)).toBe(3);
    expect(placementPoints(6)).toBe(2);
    expect(placementPoints(7)).toBe(1);
    expect(placementPoints(8)).toBe(1);
    expect(placementPoints(9)).toBe(0);
    expect(placementPoints(16)).toBe(0);
  });
});

describe('computeTeamRoundResults', () => {
  const rosterMembers: RosterMemberForScoring[] = [
    { memberId: 'm-a', teamNumber: 1 },
    { memberId: 'm-b', teamNumber: 1 },
    { memberId: 'm-c', teamNumber: 2 },
  ];

  it('같은 팀원끼리 킬을 합산하고 team_rank 를 그대로 쓴다', () => {
    const participants: RoundParticipant[] = [
      { memberId: 'm-a', kills: 3, teamRank: 5 },
      { memberId: 'm-b', kills: 2, teamRank: 5 },
      { memberId: 'm-c', kills: 1, teamRank: 2 },
    ];
    const result = computeTeamRoundResults(participants, rosterMembers, [1, 2]);
    expect(result).toEqual([
      { teamNumber: 1, kills: 5, teamRank: 5 },
      { teamNumber: 2, kills: 1, teamRank: 2 },
    ]);
  });

  it('team_rank 가 팀원끼리 어긋나면 방어적으로 최솟값을 쓴다', () => {
    const participants: RoundParticipant[] = [
      { memberId: 'm-a', kills: 1, teamRank: 3 },
      { memberId: 'm-b', kills: 1, teamRank: 5 },
    ];
    const result = computeTeamRoundResults(participants, rosterMembers, [1]);
    expect(result[0].teamRank).toBe(3);
  });

  it('매칭된 인원이 없는 팀은 kills/teamRank 가 null 이다', () => {
    const result = computeTeamRoundResults([], rosterMembers, [1, 2]);
    expect(result).toEqual([
      { teamNumber: 1, kills: null, teamRank: null },
      { teamNumber: 2, kills: null, teamRank: null },
    ]);
  });

  it('member_id 가 null 인 참가자(미등록)는 무시한다', () => {
    const participants: RoundParticipant[] = [{ memberId: null, kills: 10, teamRank: 1 }];
    const result = computeTeamRoundResults(participants, rosterMembers, [1]);
    expect(result[0]).toEqual({ teamNumber: 1, kills: null, teamRank: null });
  });
});

describe('computeRoundSheet', () => {
  it('라운드 점수를 누적하고, 최종 누적 Total 내림차순으로 순위를 매긴다', () => {
    const round1: TeamRoundResult[] = [
      { teamNumber: 1, kills: 5, teamRank: 5 }, // 5 + 3 = 8
      { teamNumber: 2, kills: 10, teamRank: 1 }, // 10 + 10 = 20
    ];
    const round2: TeamRoundResult[] = [
      { teamNumber: 1, kills: 8, teamRank: 1 }, // 8 + 10 = 18, 누적 26
      { teamNumber: 2, kills: 2, teamRank: 10 }, // 2 + 0 = 2, 누적 22
    ];
    const rows = computeRoundSheet([round1, round2], [1, 2]);

    expect(rows).toEqual([
      {
        teamNumber: 1,
        place: 1,
        totalKills: 13,
        totalScore: 26,
        rounds: [
          { roundNo: 1, kills: 5, teamRank: 5, cumulativeTotal: 8 },
          { roundNo: 2, kills: 8, teamRank: 1, cumulativeTotal: 26 },
        ],
      },
      {
        teamNumber: 2,
        place: 2,
        totalKills: 12,
        totalScore: 22,
        rounds: [
          { roundNo: 1, kills: 10, teamRank: 1, cumulativeTotal: 20 },
          { roundNo: 2, kills: 2, teamRank: 10, cumulativeTotal: 22 },
        ],
      },
    ]);
  });

  it('라운드가 0개면 모든 팀이 0점, 팀번호 순서 그대로 순위를 매긴다', () => {
    const rows = computeRoundSheet([], [1, 2, 3]);
    expect(rows.map((r) => [r.teamNumber, r.place, r.totalScore])).toEqual([
      [1, 1, 0],
      [2, 2, 0],
      [3, 3, 0],
    ]);
  });

  it('매칭 안 된 팀(kills/teamRank null)은 그 라운드 점수를 0으로 취급한다', () => {
    const round1: TeamRoundResult[] = [{ teamNumber: 1, kills: null, teamRank: null }];
    const rows = computeRoundSheet([round1], [1]);
    expect(rows[0].rounds[0]).toEqual({ roundNo: 1, kills: null, teamRank: null, cumulativeTotal: 0 });
  });
});
