// PUBG 매치 응답을 해석하고 우리 내전인지 판별하는 순수 함수들.
// 외부 의존(네트워크, DB)이 없어야 테스트가 쉽고 빠르다.

// 내전 인원은 50~70명으로 변동한다. 40 은 여유 있는 바닥값이고,
// 클랜원 몇 명이 사설방에서 연습한 것을 걸러내는 역할을 한다.
export const MIN_PARTICIPANTS = 40;

// 실측: 우리 내전 63/64 = 98%, 남의 모임 15/64 = 23%. 중간값이 없다.
export const MIN_CLAN_RATIO = 0.5;

// 시작하자마자 한 명이 튕겨서 방장이 리방(재시작)하는 경우가 있다. PUBG 서버는
// 이걸 그냥 아주 짧게 끝난 매치로 본다 — 아무도 무엇도 안 했으니 킬·데미지·
// 생존시간이 전원 0에 가깝다. 진짜 매치라면 아무리 못해도 몇 명은 몇 초 이상
// 버티거나 데미지를 주고받으므로, 전원이 이 조건이면 리방으로 본다.
// timeSurvived 는 정확히 0이 아니라 근처 값이 찍힐 수 있어 5초 여유를 둔다.
const RESTART_TIME_SURVIVED_THRESHOLD = 5;

export function isRestartMatch(participants) {
  return (
    participants.length > 0 &&
    participants.every(
      (p) => p.kills === 0 && p.damageDealt === 0 && (p.timeSurvived ?? 0) <= RESTART_TIME_SURVIVED_THRESHOLD,
    )
  );
}

// "확실히 완결난 매치"인지 보는 두 번째, 더 확실한 판단 기준이다.
// isRestartMatch 는 참가자 개개인의 스탯을 보는데, 이건 어쨌든 개개인의 행동에
// 달려 있어서 이론상 흔들릴 여지가 있다(예: 한 명이 재시작 직전 짧게라도
// 사격해서 데미지가 찍히면 안 걸린다). 반대로 매치 길이는 서버가 재는 값이라
// 개인이 어떻게 하든 못 바꾼다 — 첫 자기장이 보통 경기 시작 2~3분 뒤에나
// 뜨므로, 그보다도 훨씬 짧은 60초 안에 "끝난" 매치는 사람이 손 쓸 도리 없이
// 리방이라고 봐도 된다. 그래서 이 검사를 스탯 검사보다 먼저, 우선으로 본다.
export const MIN_MATCH_DURATION_SECONDS = 60;

export function classifyMatch({
  matchType,
  participantCount,
  clanMemberCount,
  participants,
  durationSeconds,
}) {
  if (matchType !== 'custom') {
    return { isScrim: false, reason: `matchType 이 custom 이 아니다 (${matchType})` };
  }

  // durationSeconds 는 선택 인자다 — dak.gg 백필처럼 애초에 이 값이 없는
  // 출처도 있어서(비교 대상이 없으니 null 이면 그냥 건너뛴다).
  if (durationSeconds != null && durationSeconds < MIN_MATCH_DURATION_SECONDS) {
    return {
      isScrim: false,
      reason: `경기 시간이 ${durationSeconds}초뿐이다 (${MIN_MATCH_DURATION_SECONDS}초 미만) — 리방(재시작)한 매치로 보인다`,
    };
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

  // participants 도 선택 인자다 — 호출부가 이미 참가자별 스탯을 갖고 있을 때만
  // 넘긴다(polling.mjs). 없으면 이 검사는 건너뛴다.
  // durationSeconds 검사를 이미 통과한 뒤라, 여기 걸리는 건 "60초는 넘었지만
  // 그래도 아무도 아무것도 안 한" 애매한 경우를 잡는 보조 그물이다.
  if (participants && isRestartMatch(participants)) {
    return {
      isScrim: false,
      reason: '전원 스탯이 0에 가깝다 — 시작 직후 리방(재시작)한 매치로 보인다',
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
