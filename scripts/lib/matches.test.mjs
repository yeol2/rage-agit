import { describe, expect, it } from 'vitest';
import { classifyMatch, extractMatchSummary, extractParticipants, totalKills } from './matches.mjs';

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
  // 합 킬을 원하는 만큼 만들어내는 참가자 목록.
  const withKills = (total, count = 64) =>
    Array.from({ length: count }, (_, i) => ({ kills: i < total ? 1 : 0 }));

  it('커스텀에 클랜원 비율이 높고 킬도 충분하면 내전이다', () => {
    // 08-02 실측값
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      participants: withKills(61),
    });
    expect(result.isScrim).toBe(true);
  });

  it('경쟁전은 내전이 아니다', () => {
    // 폴링이 걸러낸 것 중 압도적 다수(2165건)가 이 경우다 — 클랜원이 혼자 돌린
    // 랭크 게임도 합 킬은 30 을 훌쩍 넘으므로 킬만 봐서는 못 거른다.
    const result = classifyMatch({
      matchType: 'competitive',
      participantCount: 64,
      clanMemberCount: 60,
      participants: withKills(60),
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('matchType');
  });

  it('클랜원 비율이 낮으면 내전이 아니다', () => {
    // 07-31 실측값 — 겉모습도 킬 수도 우리 내전과 같지만 남의 모임이었다
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 15,
      participants: withKills(60),
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('클랜원 비율');
  });

  it('경계값 50% 는 내전으로 본다', () => {
    const args = { matchType: 'custom', participantCount: 64, participants: withKills(60) };
    expect(classifyMatch({ ...args, clanMemberCount: 32 }).isScrim).toBe(true);
    expect(classifyMatch({ ...args, clanMemberCount: 31 }).isScrim).toBe(false);
  });

  it('합 킬 경계값 30은 내전이 아니고 31은 내전이다', () => {
    const args = { matchType: 'custom', participantCount: 64, clanMemberCount: 63 };
    expect(classifyMatch({ ...args, participants: withKills(30) }).isScrim).toBe(false);
    expect(classifyMatch({ ...args, participants: withKills(31) }).isScrim).toBe(true);
  });

  it('전원 스탯이 0이면 내전이 아니다(리방)', () => {
    // 예전엔 isRestartMatch 가 따로 잡던 경우다. 킬이 0 이라 합 킬 검사에 걸린다.
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 64,
      clanMemberCount: 63,
      participants: withKills(0),
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('합 킬');
  });

  it('2026-08-16 재경기를 내전에서 제외한다', () => {
    // 63명이 13분(779초)을 보내고 합 킬 0, 합 데미지 123. 6분 뒤 같은 맵에서
    // 진짜 4라운드를 다시 했다. 데미지가 0 이 아니고 생존시간도 길어서 예전
    // 리방 검사로는 못 잡았고, 779초라 경기 시간 검사도 통과했다.
    const participants = Array.from({ length: 63 }, (_, i) => ({
      kills: 0,
      damageDealt: i < 3 ? 41 : 0,
      timeSurvived: 700,
    }));
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 63,
      clanMemberCount: 63,
      participants,
    });
    expect(result.isScrim).toBe(false);
  });

  it('사설방 연습처럼 인원이 적으면 킬이 모자라 내전이 아니다', () => {
    // 합 킬은 참가자 수를 넘을 수 없다 — 4명이 아무리 싸워도 30 을 못 넘는다.
    // 예전의 MIN_PARTICIPANTS 검사를 이 성질이 대신한다.
    const result = classifyMatch({
      matchType: 'custom',
      participantCount: 4,
      clanMemberCount: 4,
      participants: withKills(3, 4),
    });
    expect(result.isScrim).toBe(false);
    expect(result.reason).toContain('합 킬');
  });

  it('participants 를 안 넘기면(dak.gg 백필) 킬 검사를 건너뛴다', () => {
    const result = classifyMatch({ matchType: 'custom', participantCount: 64, clanMemberCount: 63 });
    expect(result.isScrim).toBe(true);
  });
});

describe('totalKills', () => {
  it('참가자들의 킬을 더한다', () => {
    expect(totalKills([{ kills: 3 }, { kills: 0 }, { kills: 5 }])).toBe(8);
  });

  it('킬이 없는 참가자(백필 데이터)는 0 으로 센다', () => {
    expect(totalKills([{ kills: 2 }, {}])).toBe(2);
  });

  it('참가자가 없으면 0 이다', () => {
    expect(totalKills([])).toBe(0);
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
