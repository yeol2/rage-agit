import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatSurvival,
  groupParticipantsByTeam,
  sortByTeamRank,
  type ScrimParticipant,
} from './scrimData';

function participant(overrides: Partial<ScrimParticipant>): ScrimParticipant {
  return {
    pubgIgn: 'Ez_Test',
    discordNickname: null,
    teamId: 1,
    teamRank: 1,
    kills: 0,
    assists: 0,
    damageDealt: 0,
    dbnos: 0,
    headshotKills: 0,
    timeSurvived: 0,
    distance: 0,
    ...overrides,
  };
}

describe('sortByTeamRank', () => {
  it('팀 순위 오름차순으로 정렬한다', () => {
    const rows = [
      participant({ pubgIgn: 'C', teamRank: 3, teamId: 30 }),
      participant({ pubgIgn: 'A', teamRank: 1, teamId: 10 }),
      participant({ pubgIgn: 'B', teamRank: 2, teamId: 20 }),
    ];
    expect(sortByTeamRank(rows).map((r) => r.pubgIgn)).toEqual(['A', 'B', 'C']);
  });

  it('같은 팀 안에서는 킬이 많은 순으로 둔다', () => {
    // dak.gg 처럼 팀별로 묶어 보되, 팀 안에서는 잘한 사람이 위로 온다.
    const rows = [
      participant({ pubgIgn: 'low', teamRank: 1, teamId: 7, kills: 0 }),
      participant({ pubgIgn: 'high', teamRank: 1, teamId: 7, kills: 5 }),
      participant({ pubgIgn: 'mid', teamRank: 1, teamId: 7, kills: 2 }),
    ];
    expect(sortByTeamRank(rows).map((r) => r.pubgIgn)).toEqual(['high', 'mid', 'low']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const rows = [
      participant({ pubgIgn: 'B', teamRank: 2 }),
      participant({ pubgIgn: 'A', teamRank: 1 }),
    ];
    sortByTeamRank(rows);
    expect(rows.map((r) => r.pubgIgn)).toEqual(['B', 'A']);
  });
});

describe('groupParticipantsByTeam', () => {
  it('등수순으로 이미 정렬된 배열을 팀별로 묶는다', () => {
    const sorted = sortByTeamRank([
      participant({ pubgIgn: 'B1', teamRank: 2, teamId: 20 }),
      participant({ pubgIgn: 'A1', teamRank: 1, teamId: 10 }),
      participant({ pubgIgn: 'A2', teamRank: 1, teamId: 10 }),
      participant({ pubgIgn: 'B2', teamRank: 2, teamId: 20 }),
    ]);
    const groups = groupParticipantsByTeam(sorted);
    expect(groups.map((g) => g.teamId)).toEqual([10, 20]);
    expect(groups.map((g) => g.teamRank)).toEqual([1, 2]);
    expect(groups[0].players.map((p) => p.pubgIgn)).toEqual(['A1', 'A2']);
    expect(groups[1].players.map((p) => p.pubgIgn)).toEqual(['B1', 'B2']);
  });

  it('빈 배열이면 빈 배열을 낸다', () => {
    expect(groupParticipantsByTeam([])).toEqual([]);
  });
});

describe('formatDistance', () => {
  it('미터를 킬로미터로 바꾼다', () => {
    // 실측: Ez_Grim 의 07-26 경기가 6472m 이고 dak.gg 는 6.47km 로 보여준다.
    expect(formatDistance(6472)).toBe('6.47km');
  });

  it('1km 미만도 km 로 보여준다', () => {
    expect(formatDistance(320)).toBe('0.32km');
  });

  it('값이 없으면 하이픈을 보여준다', () => {
    expect(formatDistance(null)).toBe('-');
  });
});

describe('formatSurvival', () => {
  it('초를 분:초 로 바꾼다', () => {
    // 실측: Ez_Grim 의 07-26 경기 생존 시간이 22분 52초다.
    expect(formatSurvival(1372)).toBe('22:52');
  });

  it('한 자리 초를 0 으로 채운다', () => {
    expect(formatSurvival(1265)).toBe('21:05');
  });

  it('값이 없으면 하이픈을 보여준다', () => {
    expect(formatSurvival(null)).toBe('-');
  });
});
