// PUBG 매치 응답을 해석하고 우리 내전인지 판별하는 순수 함수들.
// 외부 의존(네트워크, DB)이 없어야 테스트가 쉽고 빠르다.

// 실측: 우리 내전 63/64 = 98%, 남의 모임 15/64 = 23%. 중간값이 없다.
export const MIN_CLAN_RATIO = 0.5;

// 합 킬로 "제대로 치러진 매치"를 가른다. 64명이 20분 가까이 싸웠다면 합 킬이
// 60 언저리 나오고, 실측된 정상 내전의 최저값도 이 값을 한참 웃돈다.
//
// 이 검사 하나가 예전의 세 조건을 대신한다.
//   - 경기 시간 60초 미만(리방): 60초 안에 끝나면 아무도 못 죽여서 킬이 0이다.
//   - 전원 스탯 0(리방): 정의상 킬이 0이다.
//   - 참가자 40명 미만(사설방 연습): 합 킬은 아무리 많아도 참가자 수를 못 넘으므로,
//     킬이 30을 넘으려면 최소 30명 넘게 있어야 한다.
// 게다가 앞의 두 검사로는 못 잡던 것도 잡는다 — 2026-08-16 4번째 경기는 63명이
// 13분을 보내고 합 킬 0, 합 데미지 123 이었다(누군가 총을 쏴서 데미지가 0이
// 아니고 생존시간도 길어 리방 검사를 통과했고, 779초라 시간 검사도 통과했다).
export const MIN_TOTAL_KILLS = 30;

export function totalKills(participants) {
  return participants.reduce((sum, p) => sum + (p.kills ?? 0), 0);
}

export function classifyMatch({ matchType, participantCount, clanMemberCount, participants }) {
  if (matchType !== 'custom') {
    return { isScrim: false, reason: `matchType 이 custom 이 아니다 (${matchType})` };
  }

  const ratio = participantCount === 0 ? 0 : clanMemberCount / participantCount;
  if (ratio < MIN_CLAN_RATIO) {
    return {
      isScrim: false,
      reason: `클랜원 비율이 낮다 (${clanMemberCount}/${participantCount} = ${Math.round(ratio * 100)}%)`,
    };
  }

  // participants 는 선택 인자다 — dak.gg 백필처럼 참가자별 스탯이 아예 없는
  // 출처도 있어서, 없으면 이 검사는 건너뛴다.
  if (participants) {
    const kills = totalKills(participants);
    if (kills <= MIN_TOTAL_KILLS) {
      return {
        isScrim: false,
        reason: `합 킬이 ${kills}뿐이다 (${MIN_TOTAL_KILLS} 이하) — 리방이거나 중단하고 다시 치른 매치로 보인다`,
      };
    }
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
