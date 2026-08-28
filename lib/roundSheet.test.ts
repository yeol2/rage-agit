import { describe, expect, it } from 'vitest';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  squadsFromTeamIds,
  placementPoints,
  type MatchParticipantForSquads,
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
        standing: 1,
        totalKills: 13,
        totalPlacementPoints: 13,
        totalScore: 26,
        rounds: [
          { roundNo: 1, kills: 5, teamRank: 5, rankScore: 3, roundTotal: 8 },
          { roundNo: 2, kills: 8, teamRank: 1, rankScore: 10, roundTotal: 18 },
        ],
      },
      {
        teamNumber: 2,
        standing: 2,
        totalKills: 12,
        totalPlacementPoints: 10,
        totalScore: 22,
        rounds: [
          { roundNo: 1, kills: 10, teamRank: 1, rankScore: 10, roundTotal: 20 },
          { roundNo: 2, kills: 2, teamRank: 10, rankScore: 0, roundTotal: 2 },
        ],
      },
    ]);
  });

  it('라운드가 0개면 모든 팀이 0점, 팀번호 순서 그대로 순위를 매긴다', () => {
    const rows = computeRoundSheet([], [1, 2, 3]);
    expect(rows.map((r) => [r.teamNumber, r.standing, r.totalScore])).toEqual([
      [1, 1, 0],
      [2, 2, 0],
      [3, 3, 0],
    ]);
  });

  it('총점이 같으면 순위점수가 높은 쪽이 위다', () => {
    // 2026-07-20 내전이 42점 동점에서 순위점수 17 대 16 으로 갈렸던 상황과 같은
    // 구조다 — 킬로 벌어놓은 1팀과 등수로 벌어놓은 2팀이 총점만 같다.
    const round1: TeamRoundResult[] = [
      { teamNumber: 1, kills: 10, teamRank: 9 }, // 10 + 0 = 10
      { teamNumber: 2, kills: 4, teamRank: 4 }, //   4 + 4 = 8
    ];
    const round2: TeamRoundResult[] = [
      { teamNumber: 1, kills: 10, teamRank: 9 }, // 10 + 0 = 10, 누적 20 / 순위점수 0
      { teamNumber: 2, kills: 6, teamRank: 2 }, //   6 + 6 = 12, 누적 20 / 순위점수 10
    ];

    const rows = computeRoundSheet([round1, round2], [1, 2]);
    expect(rows.map((r) => [r.teamNumber, r.standing, r.totalScore, r.totalPlacementPoints])).toEqual([
      [2, 1, 20, 10],
      [1, 2, 20, 0],
    ]);
  });

  it('총점과 순위점수가 모두 같으면 팀번호 순으로 둔다', () => {
    const round: TeamRoundResult[] = [
      { teamNumber: 3, kills: 5, teamRank: 4 },
      { teamNumber: 1, kills: 5, teamRank: 4 },
      { teamNumber: 2, kills: 5, teamRank: 4 },
    ];
    const rows = computeRoundSheet([round], [3, 1, 2]);
    expect(rows.map((r) => [r.teamNumber, r.standing])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('매칭 안 된 팀(kills/teamRank null)은 그 라운드 점수를 0으로 취급한다', () => {
    const round1: TeamRoundResult[] = [{ teamNumber: 1, kills: null, teamRank: null }];
    const rows = computeRoundSheet([round1], [1]);
    expect(rows[0].rounds[0]).toEqual({
      roundNo: 1,
      kills: null,
      teamRank: null,
      rankScore: null,
      roundTotal: 0,
    });
  });
});

describe('squadsFromTeamIds', () => {
  it('PUBG 가 매긴 team_id 를 그대로 팀 번호로 쓴다', () => {
    const matches: MatchParticipantForSquads[][] = [
      [
        { memberId: 'a', teamId: 7 },
        { memberId: 'b', teamId: 7 },
        { memberId: 'c', teamId: 3 },
      ],
    ];
    const { squadByMemberId, unstableMemberIds } = squadsFromTeamIds(matches);
    expect(squadByMemberId.get('a')).toBe(7);
    expect(squadByMemberId.get('b')).toBe(7);
    expect(squadByMemberId.get('c')).toBe(3);
    expect(unstableMemberIds).toEqual([]);
  });

  // 예전 union-find 방식이 못 지키던 것 — 같은 경기인데 행이 도착한 순서가
  // 달라지면 팀 번호가 통째로 뒤집혔다. team_id 를 쓰면 순서를 안 탄다.
  it('행 순서가 뒤집혀도 팀 번호가 같다', () => {
    const round: MatchParticipantForSquads[] = [
      { memberId: 'a', teamId: 1 },
      { memberId: 'b', teamId: 1 },
      { memberId: 'c', teamId: 16 },
      { memberId: 'd', teamId: 16 },
    ];
    const forward = squadsFromTeamIds([round]);
    const reversed = squadsFromTeamIds([[...round].reverse()]);
    expect([...forward.squadByMemberId].sort()).toEqual([...reversed.squadByMemberId].sort());
  });

  it('세션 도중 team_id 가 바뀐 사람을 알려준다', () => {
    const matches: MatchParticipantForSquads[][] = [
      [{ memberId: 'a', teamId: 5 }],
      [{ memberId: 'a', teamId: 9 }], // 2라운드에 다른 번호
    ];
    const { squadByMemberId, unstableMemberIds } = squadsFromTeamIds(matches);
    expect(squadByMemberId.get('a')).toBe(5); // 1라운드 번호를 쓴다
    expect(unstableMemberIds).toEqual(['a']);
  });

  it('선수 교체로 한 팀이 4명을 넘어도 그대로 둔다', () => {
    const matches: MatchParticipantForSquads[][] = [
      [
        { memberId: 'a', teamId: 2 },
        { memberId: 'b', teamId: 2 },
        { memberId: 'c', teamId: 2 },
        { memberId: 'd', teamId: 2 },
      ],
      [{ memberId: 'e', teamId: 2 }], // 2라운드에 교체 투입
    ];
    const { squadByMemberId, unstableMemberIds } = squadsFromTeamIds(matches);
    expect(squadByMemberId.get('e')).toBe(2);
    expect(unstableMemberIds).toEqual([]);
  });

  it('member_id 가 null 인 참가자는 무시한다', () => {
    const matches: MatchParticipantForSquads[][] = [
      [
        { memberId: null, teamId: 1 },
        { memberId: 'a', teamId: 1 },
      ],
    ];
    const { squadByMemberId } = squadsFromTeamIds(matches);
    expect(squadByMemberId.size).toBe(1);
    expect(squadByMemberId.get('a')).toBe(1);
  });
});

