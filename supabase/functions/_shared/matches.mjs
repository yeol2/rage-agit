// PUBG 매치 응답을 해석하고 우리 내전인지 판별하는 순수 함수들.
// 외부 의존(네트워크, DB)이 없어야 테스트가 쉽고 빠르다.

// 내전 인원은 50~70명으로 변동한다. 40 은 여유 있는 바닥값이고,
// 클랜원 몇 명이 사설방에서 연습한 것을 걸러내는 역할을 한다.
export const MIN_PARTICIPANTS = 40;

// 실측: 우리 내전 63/64 = 98%, 남의 모임 15/64 = 23%. 중간값이 없다.
export const MIN_CLAN_RATIO = 0.5;

export function classifyMatch({ matchType, participantCount, clanMemberCount }) {
  if (matchType !== 'custom') {
    return { isScrim: false, reason: `matchType 이 custom 이 아니다 (${matchType})` };
  }
  if (participantCount < MIN_PARTICIPANTS) {
    return {
      isScrim: false,
      reason: `참가자가 ${participantCount}명뿐이다 (${MIN_PARTICIPANTS}명 이상 필요)`,
    };
  }

  const ratio = participantCount === 0 ? 0 : clanMemberCount / participantCount;
  if (ratio < MIN_CLAN_RATIO) {
    return {
      isScrim: false,
      reason: `클랜원 비율이 낮다 (${clanMemberCount}/${participantCount} = ${Math.round(ratio * 100)}%)`,
    };
  }

  return {
    isScrim: true,
    reason: `클랜원 ${clanMemberCount}/${participantCount} = ${Math.round(ratio * 100)}%`,
  };
}

function participantsOf(body) {
  return (body.included ?? []).filter((i) => i.type === 'participant');
}

export function extractMatchSummary(body) {
  const a = body.data.attributes;
  return {
    pubgMatchId: body.data.id,
    playedAt: a.createdAt,
    matchType: a.matchType,
    gameMode: a.gameMode,
    mapName: a.mapName ?? null,
    durationSeconds: a.duration ?? null,
    participantCount: participantsOf(body).length,
    rawAttributes: a,
  };
}

export function extractParticipants(body, memberIdByAccountId) {
  // roster 가 팀 순위를 갖고 있고, 소속 참가자를 id 로 가리킨다.
  // 참가자 자신은 팀 정보를 모르므로 여기서 이어 붙인다.
  const teamByParticipantId = new Map();
  for (const roster of (body.included ?? []).filter((i) => i.type === 'roster')) {
    const { rank, teamId } = roster.attributes.stats;
    for (const ref of roster.relationships?.participants?.data ?? []) {
      teamByParticipantId.set(ref.id, { teamRank: rank, teamId });
    }
  }

  return participantsOf(body).map((p) => {
    const s = p.attributes.stats;
    const team = teamByParticipantId.get(p.id) ?? { teamRank: null, teamId: null };

    return {
      pubgAccountId: s.playerId,
      pubgIgn: s.name,
      memberId: memberIdByAccountId.get(s.playerId) ?? null,
      teamId: team.teamId,
      teamRank: team.teamRank,
      kills: s.kills,
      assists: s.assists,
      damageDealt: s.damageDealt,
      dbnos: s.DBNOs,
      headshotKills: s.headshotKills,
      winPlace: s.winPlace,
      timeSurvived: s.timeSurvived,
      heals: s.heals,
      boosts: s.boosts,
      longestKill: s.longestKill,
      revives: s.revives,
      rawStats: s,
    };
  });
}
