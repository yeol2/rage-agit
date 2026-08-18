import { describe, expect, it } from 'vitest';
import { classifyMatch, extractMatchSummary, extractParticipants, isRestartMatch } from './matches.mjs';

// 실제 응답을 본떠 작게 만든다.
// 진짜 응답(참가자 64명)을 저장소에 넣으면 클랜원 실명이 git 에 들어간다.
function makeMatch({
  matchId = 'match-1',
  matchType = 'custom',
  gameMode = 'esports-squad',
  mapName = 'Baltic_Main',
  duration = 1624,
  createdAt = '2026-08-02T11:01:10Z',
  teams = [],
} = {}) {
  const included = [];

  teams.forEach((members, teamIndex) => {
    const participantIds = [];

    members.forEach((m, memberIndex) => {
      const id = `p-${teamIndex}-${memberIndex}`;
      participantIds.push(id);
      included.push({
        type: 'participant',
        id,
        attributes: {
          stats: {
            name: m.name,
            playerId: m.playerId,
            kills: m.kills ?? 0,
            assists: m.assists ?? 0,
            damageDealt: m.damageDealt ?? 0,
            DBNOs: m.dbnos ?? 0,
            headshotKills: m.headshotKills ?? 0,
            winPlace: m.winPlace ?? 1,
            killPlace: m.killPlace ?? 1,
            timeSurvived: m.timeSurvived ?? 0,
            heals: m.heals ?? 0,
            boosts: m.boosts ?? 0,
            longestKill: m.longestKill ?? 0,
            revives: m.revives ?? 0,
            weaponsAcquired: 7,
          },
        },
      });
    });

    included.push({
      type: 'roster',
      id: `r-${teamIndex}`,
      attributes: { stats: { rank: teamIndex + 1, teamId: 100 + teamIndex }, won: 'false' },
      relationships: {
        participants: { data: participantIds.map((id) => ({ type: 'participant', id })) },
      },
    });
  });

  included.push({ type: 'asset', id: 'a-1', attributes: { URL: 'https://telemetry' } });

  return {
    data: {
      type: 'match',
      id: matchId,
      attributes: {
        matchType,
        gameMode,
        mapName,
        duration,
        createdAt,
        isCustomMatch: matchType === 'custom',
      },
    },
    included,
  };
}

// 팀 개수만큼 4인 팀을 만든다. 이름은 t{팀}p{자리} 형태.
function makeTeams(teamCount) {
  return Array.from({ length: teamCount }, (_, t) =>
    Array.from({ length: 4 }, (_, p) => ({
      name: `Ez_t${t}p${p}`,
      playerId: `account.t${t}p${p}`,
    })),
  );
}

describe('classifyMatch', () => {
  it('커스텀에 인원이 충분하고 클랜원 비율이 높으면 내전이다', () => {
    // 08-02 실측값
    const result = classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 63 });
    expect(result.isScrim).toBe(true);
  });

  it('클랜원 비율이 낮으면 내전이 아니다', () => {
    // 07-31 실측값 — 겉모습은 내전과 완전히 같지만 남의 모임이었다
    const result = classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 15 });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('클랜원 비율');
  });

  it('클랜원만 있어도 인원이 적으면 내전이 아니다', () => {
    // 클랜원 4명이 사설방에서 연습하는 경우 — 비율은 100% 지만 내전이 아니다
    const result = classifyMatch({ matchType: 'custom', participantCount: 4, clanMemberCount: 4 });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('참가자');
  });

  it('경쟁전은 내전이 아니다', () => {
    const result = classifyMatch({
      matchType: 'competitive',
      participantCount: 64,
      clanMemberCount: 60,
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('matchType');
  });

  it('경계값 50% 는 내전으로 본다', () => {
    expect(
      classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 32 }).isScrim,
    ).toBe(true);
    expect(
      classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 31 }).isScrim,
    ).toBe(false);
  });

  it('경계값 40명은 내전으로 본다', () => {
    expect(
      classifyMatch({ matchType: 'custom', participantCount: 40, clanMemberCount: 40 }).isScrim,
    ).toBe(true);
    expect(
      classifyMatch({ matchType: 'custom', participantCount: 39, clanMemberCount: 39 }).isScrim,
    ).toBe(false);
  });

  it('전원 스탯이 0이면 인원·비율 조건을 만족해도 내전이 아니다(리방)', () => {
    const participants = Array.from({ length: 64 }, () => ({
      kills: 0,
      damageDealt: 0,
      timeSurvived: 0,
    }));
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      participants,
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('리방');
  });

  it('한 명이라도 스탯이 있으면 정상적인 내전으로 본다', () => {
    const participants = Array.from({ length: 64 }, (_, i) => ({
      kills: i === 0 ? 1 : 0,
      damageDealt: 0,
      timeSurvived: 0,
    }));
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      participants,
    });
    expect(result.isScrim).toBe(true);
  });

  it('participants 를 안 넘기면 리방 검사를 건너뛴다', () => {
    // 호출부(dak.gg 백필)가 아직 이 검사를 안 쓰는 경우를 대비한 하위 호환성.
    const result = classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 63 });
    expect(result.isScrim).toBe(true);
  });

  it('경기 시간이 60초 미만이면 스탯과 무관하게 내전이 아니다(리방)', () => {
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      durationSeconds: 45,
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('경기 시간');
  });

  it('경계값 60초는 내전으로 본다', () => {
    expect(
      classifyMatch({
        matchType: 'custom',
        participantCount: 64,
        clanMemberCount: 63,
        durationSeconds: 60,
      }).isScrim,
    ).toBe(true);
    expect(
      classifyMatch({
        matchType: 'custom',
        participantCount: 64,
        clanMemberCount: 63,
        durationSeconds: 59,
      }).isScrim,
    ).toBe(false);
  });

  it('durationSeconds 를 안 넘기면(dak.gg 백필 등) 그 검사를 건너뛴다', () => {
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      durationSeconds: null,
    });
    expect(result.isScrim).toBe(true);
  });
});

describe('isRestartMatch', () => {
  it('전원 킬·데미지·생존시간이 0이면 리방이다', () => {
    const participants = [
      { kills: 0, damageDealt: 0, timeSurvived: 0 },
      { kills: 0, damageDealt: 0, timeSurvived: 3 },
    ];
    expect(isRestartMatch(participants)).toBe(true);
  });

  it('한 명이라도 킬이 있으면 리방이 아니다', () => {
    const participants = [
      { kills: 1, damageDealt: 0, timeSurvived: 0 },
      { kills: 0, damageDealt: 0, timeSurvived: 0 },
    ];
    expect(isRestartMatch(participants)).toBe(false);
  });

  it('한 명이라도 데미지를 줬으면 리방이 아니다', () => {
    const participants = [{ kills: 0, damageDealt: 50, timeSurvived: 10 }];
    expect(isRestartMatch(participants)).toBe(false);
  });

  it('생존시간이 임계값(5초)을 넘으면 리방이 아니다', () => {
    const participants = [{ kills: 0, damageDealt: 0, timeSurvived: 6 }];
    expect(isRestartMatch(participants)).toBe(false);
  });

  it('생존시간이 임계값 이내면 리방이다', () => {
    const participants = [{ kills: 0, damageDealt: 0, timeSurvived: 5 }];
    expect(isRestartMatch(participants)).toBe(true);
  });

  it('참가자가 없으면 리방이 아니다(빈 매치를 오판하지 않는다)', () => {
    expect(isRestartMatch([])).toBe(false);
  });
});

describe('extractMatchSummary', () => {
  it('매치 속성을 뽑아낸다', () => {
    const body = makeMatch({ teams: makeTeams(2) });
    expect(extractMatchSummary(body)).toEqual({
      pubgMatchId: 'match-1',
      playedAt: '2026-08-02T11:01:10Z',
      matchType: 'custom',
      gameMode: 'esports-squad',
      mapName: 'Baltic_Main',
      durationSeconds: 1624,
      participantCount: 8,
      rawAttributes: body.data.attributes,
    });
  });
});

describe('extractParticipants', () => {
  it('팀 순위를 그 팀 소속 참가자 전원에게 붙인다', () => {
    const body = makeMatch({ teams: makeTeams(3) });
    const rows = extractParticipants(body, new Map());

    expect(rows).toHaveLength(12);

    const firstTeam = rows.filter((r) => r.teamRank === 1);
    expect(firstTeam).toHaveLength(4);
    expect(firstTeam.every((r) => r.teamId === 100)).toBe(true);

    const thirdTeam = rows.filter((r) => r.teamRank === 3);
    expect(thirdTeam.every((r) => r.teamId === 102)).toBe(true);
  });

  it('accountId 로 member_id 를 붙이고, 없으면 비워둔다', () => {
    const body = makeMatch({ teams: makeTeams(1) });
    const known = new Map([['account.t0p0', 'member-uuid-1']]);
    const rows = extractParticipants(body, known);

    expect(rows.find((r) => r.pubgAccountId === 'account.t0p0').memberId).toBe('member-uuid-1');
    expect(rows.find((r) => r.pubgAccountId === 'account.t0p1').memberId).toBeNull();
  });

  it('스탯을 컬럼 이름으로 옮긴다', () => {
    const body = makeMatch({
      teams: [
        [
          {
            name: 'Ez_Code',
            playerId: 'account.x',
            kills: 3,
            damageDealt: 412.5,
            dbnos: 2,
            timeSurvived: 1200.5,
          },
        ],
      ],
    });
    const [row] = extractParticipants(body, new Map());

    expect(row.pubgIgn).toBe('Ez_Code');
    expect(row.kills).toBe(3);
    expect(row.damageDealt).toBe(412.5);
    expect(row.dbnos).toBe(2);
    expect(row.timeSurvived).toBe(1200.5);
    expect(row.rawStats.weaponsAcquired).toBe(7);
  });

  it('asset(텔레메트리)은 참가자로 세지 않는다', () => {
    const body = makeMatch({ teams: makeTeams(2) });
    expect(extractParticipants(body, new Map())).toHaveLength(8);
  });
});
