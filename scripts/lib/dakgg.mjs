// dak.gg 화면에서 읽은 내전을 우리 DB 행으로 옮기는 순수 함수들.
// 네트워크와 DB 는 여기 없다 — 그래야 테스트가 실제 데이터 없이 돈다.

import { createHash } from 'node:crypto';

// dak.gg 는 맵을 한글로 보여주고 우리 DB 는 API 값을 쓴다.
// 에란겔이 Baltic_Main 인 것에 주의 — Erangel_Main 으로 적으면
// 같은 맵이 두 이름으로 갈라진다.
export const MAP_NAMES = {
  에란겔: 'Baltic_Main',
  미라마: 'Desert_Main',
  태이고: 'Tiger_Main',
  사녹: 'Savage_Main',
  데스턴: 'Kiki_Main',
  론도: 'Neon_Main',
  비켄디: 'DihorOtok_Main',
};

export function toMapName(korean) {
  const name = MAP_NAMES[korean];
  if (!name) {
    throw new Error(
      `모르는 맵 이름: '${korean}' — scripts/lib/dakgg.mjs 의 MAP_NAMES 에 추가할 것`,
    );
  }
  return name;
}

// 내용으로 만든 매치 식별자의 재료.
// 같은 날 4경기는 참가 인원이 같으므로 닉네임만으로는 구분되지 않는다.
// 킬을 붙여야 경기끼리 갈라진다.
export function contentKey(participants) {
  return participants
    .map((p) => `${p.ign}:${p.kills}`)
    .sort()
    .join(',');
}

// 순번이 아니라 해시인 이유: 순번은 넣는 순서에 의존해서, 나중에 그날
// 경기를 하나 더 발견하면 번호가 밀려 같은 매치가 두 번 들어간다.
export function matchFingerprint({ scrimDate, mapName, participants }) {
  const body = `${scrimDate}|${mapName}|${contentKey(participants)}`;
  return `dakgg:${createHash('sha1').update(body).digest('hex').slice(0, 16)}`;
}

// dak.gg 는 날짜까지만 준다. played_at 은 not null 이고 세션 묶기가
// 한국시간 날짜를 보므로, 그날 20시대의 자리표시자를 만든다.
// 화면에서는 source='dakgg' 인 매치의 시각을 감춘다 — 보여주면
// 20:01 이 사실인 것처럼 읽힌다.
export function placeholderPlayedAt(scrimDate, order) {
  return `${scrimDate}T20:${String(order).padStart(2, '0')}:00+09:00`;
}

const REQUIRED_FIELDS = [
  'ign',
  'teamRank',
  'kills',
  'headshotKills',
  'assists',
  'damageDealt',
  'dbnos',
  'totalDistance',
  'longestKill',
  'timeSurvived',
];

// DOM 을 잘못 읽으면 undefined 가 조용히 흘러들어와 적재할 때
// not null 위반으로 터지는데, 그때는 어느 줄이 문제인지 안 나온다.
// 여기서 누구의 어떤 칸인지 짚어 멈춘다.
export function validateFile(file) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.scrimDate ?? '')) {
    throw new Error(`scrimDate 가 YYYY-MM-DD 형식이 아니다: ${file.scrimDate}`);
  }
  if (!Array.isArray(file.matches) || file.matches.length === 0) {
    throw new Error('경기가 하나도 없다');
  }
  if (file.note !== undefined && typeof file.note !== 'string') {
    throw new Error(`note 는 문자열이어야 한다: ${JSON.stringify(file.note)}`);
  }

  for (const match of file.matches) {
    if (typeof match.order !== 'number') {
      throw new Error(`${file.scrimDate}: order 가 숫자가 아닌 경기가 있다`);
    }
    toMapName(match.map); // 모르는 맵이면 여기서 멈춘다
    if (!Array.isArray(match.participants) || match.participants.length === 0) {
      throw new Error(`${file.scrimDate} ${match.order}경기: 참가자가 없다`);
    }
    for (const p of match.participants) {
      for (const field of REQUIRED_FIELDS) {
        if (p[field] === undefined || p[field] === null) {
          throw new Error(
            `${file.scrimDate} ${match.order}경기: '${p.ign ?? '?'}' 의 ${field} 를 못 읽었다`,
          );
        }
      }
    }
  }
}

// JSON 한 경기를 matches 행 하나와 match_participants 행 여럿으로 옮긴다.
// resolve 는 닉네임으로 클랜원을 찾는 함수다 — DB 조회를 밖으로 빼서
// 이 함수가 순수하게 남는다.
export function buildMatch(file, match, resolve) {
  const mapName = toMapName(match.map);
  const pubgMatchId = matchFingerprint({
    scrimDate: file.scrimDate,
    mapName,
    participants: match.participants,
  });

  const resolved = match.participants.map((p) => ({ p, found: resolve(p.ign) }));
  const clanMemberCount = resolved.filter((r) => r.found?.memberId).length;

  return {
    match: {
      pubg_match_id: pubgMatchId,
      played_at: placeholderPlayedAt(file.scrimDate, match.order),
      match_type: 'custom', // 내전은 항상 사설방이다
      game_mode: 'squad', // 내전은 항상 스쿼드다
      map_name: mapName,
      duration_seconds: null, // dak.gg 에 없다
      participant_count: match.participants.length,
      clan_member_count: clanMemberCount,
      source: 'dakgg',
      // API 응답의 attributes 자리에 우리가 아는 출처 정보를 남긴다.
      raw_attributes: {
        source: 'dakgg',
        scrimDate: file.scrimDate,
        order: match.order,
        dakggMap: match.map,
        readFrom: file.readFrom ?? null,
        readAt: file.readAt ?? null,
      },
    },
    participants: resolved.map(({ p, found }) => ({
      pubg_match_id: pubgMatchId,
      member_id: found?.memberId ?? null,
      pubg_account_id: found?.accountId ?? null,
      pubg_ign: p.ign,
      // 팀 번호가 없다. 한 경기 안에서 순위는 팀마다 유일하므로
      // 지어낸 값이 아니라 그 경기 안에서만 유효한 팀 식별자다.
      team_id: p.teamRank,
      team_rank: p.teamRank,
      win_place: p.teamRank,
      kills: p.kills,
      assists: p.assists,
      damage_dealt: p.damageDealt,
      dbnos: p.dbnos,
      headshot_kills: p.headshotKills,
      time_survived: p.timeSurvived,
      longest_kill: p.longestKill,
      // dak.gg 표에 칸이 없다. 0 이 아니라 모른다는 뜻이다.
      heals: null,
      boosts: null,
      revives: null,
      // 합계만 알고 있어서 쪼갤 수 없다.
      walk_distance: null,
      ride_distance: null,
      total_distance: p.totalDistance,
      raw_stats: p,
    })),
  };
}
