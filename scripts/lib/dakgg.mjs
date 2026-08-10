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
