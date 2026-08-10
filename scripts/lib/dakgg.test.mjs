import { describe, expect, it } from 'vitest';
import {
  buildMatch,
  contentKey,
  matchFingerprint,
  placeholderPlayedAt,
  toMapName,
  validateFile,
} from './dakgg.mjs';

// 실제 클랜원 닉네임은 쓰지 않는다 — 저장소에 실명이 들어간다.
function p(ign, kills, extra = {}) {
  return {
    ign,
    teamRank: 1,
    kills,
    headshotKills: 0,
    assists: 0,
    damageDealt: 100,
    dbnos: 0,
    totalDistance: 1000,
    longestKill: 0,
    timeSurvived: 600,
    ...extra,
  };
}

describe('toMapName', () => {
  it('한글 맵 이름을 API 값으로 바꾼다', () => {
    expect(toMapName('미라마')).toBe('Desert_Main');
    expect(toMapName('태이고')).toBe('Tiger_Main');
  });

  it('에란겔은 Erangel_Main 이 아니라 Baltic_Main 이다', () => {
    expect(toMapName('에란겔')).toBe('Baltic_Main');
  });

  it('모르는 이름은 조용히 넘기지 않고 멈춘다', () => {
    // null 로 넘어가면 그 경기만 맵이 빈 채 들어가고 아무도 모른다.
    expect(() => toMapName('신맵')).toThrow(/신맵/);
  });
});

describe('contentKey', () => {
  it('닉네임과 킬을 정렬해 이어붙인다', () => {
    expect(contentKey([p('Ez_B', 3), p('Ez_A', 2)])).toBe('Ez_A:2,Ez_B:3');
  });

  it('읽은 순서가 달라도 같은 값이 나온다', () => {
    const a = contentKey([p('Ez_A', 2), p('Ez_B', 3)]);
    const b = contentKey([p('Ez_B', 3), p('Ez_A', 2)]);
    expect(a).toBe(b);
  });
});

describe('matchFingerprint', () => {
  const base = { scrimDate: '2026-07-19', mapName: 'Desert_Main', participants: [p('Ez_A', 2)] };

  it('dakgg: 접두사와 16자 해시를 낸다', () => {
    expect(matchFingerprint(base)).toMatch(/^dakgg:[0-9a-f]{16}$/);
  });

  it('같은 내용이면 몇 번을 계산해도 같다', () => {
    // 이게 깨지면 다시 넣을 때마다 같은 경기가 새 행으로 쌓인다.
    expect(matchFingerprint(base)).toBe(matchFingerprint(base));
  });

  it('맵이 다르면 다른 값이다', () => {
    expect(matchFingerprint({ ...base, mapName: 'Baltic_Main' })).not.toBe(matchFingerprint(base));
  });

  it('같은 날 킬이 다른 경기는 다른 값이다', () => {
    expect(matchFingerprint({ ...base, participants: [p('Ez_A', 5)] })).not.toBe(
      matchFingerprint(base),
    );
  });
});

describe('placeholderPlayedAt', () => {
  it('한국시간 20시대의 자리표시자를 낸다', () => {
    expect(placeholderPlayedAt('2026-07-19', 1)).toBe('2026-07-19T20:01:00+09:00');
    expect(placeholderPlayedAt('2026-07-19', 4)).toBe('2026-07-19T20:04:00+09:00');
  });

  it('경기 순서대로 정렬된다', () => {
    const first = new Date(placeholderPlayedAt('2026-07-19', 1));
    const second = new Date(placeholderPlayedAt('2026-07-19', 2));
    expect(first.getTime()).toBeLessThan(second.getTime());
  });

  it('한국시간 날짜가 그대로 유지된다', () => {
    // 세션 묶기가 KST 날짜를 보므로 UTC 로 밀리면 안 된다.
    const iso = placeholderPlayedAt('2026-07-19', 1);
    expect(new Date(iso).toISOString()).toBe('2026-07-19T11:01:00.000Z');
  });
});

describe('validateFile', () => {
  const good = {
    scrimDate: '2026-07-19',
    matches: [{ order: 1, map: '미라마', participants: [p('Ez_A', 2)] }],
  };

  it('멀쩡한 파일은 통과시킨다', () => {
    expect(() => validateFile(good)).not.toThrow();
  });

  it('날짜 형식이 틀리면 멈춘다', () => {
    expect(() => validateFile({ ...good, scrimDate: '7월 19일' })).toThrow(/scrimDate/);
  });

  it('경기가 없으면 멈춘다', () => {
    expect(() => validateFile({ ...good, matches: [] })).toThrow(/경기/);
  });

  it('지표가 빠진 참가자가 있으면 그게 누구인지 말해준다', () => {
    // DOM 을 잘못 읽으면 undefined 가 들어오는데, 그대로 넣으면
    // not null 위반이 나면서 어느 줄이 문제인지 안 알려준다.
    const broken = { ...p('Ez_A', 2), damageDealt: undefined };
    const file = { ...good, matches: [{ order: 1, map: '미라마', participants: [broken] }] };
    expect(() => validateFile(file)).toThrow(/Ez_A.*damageDealt/);
  });

  it('note 가 문자열이면 통과시킨다', () => {
    expect(() => validateFile({ ...good, note: '저티어' })).not.toThrow();
  });

  it('note 가 문자열이 아니면 멈춘다', () => {
    // 오타로 배열·객체가 들어가면 세션 제목에 '[object Object]' 가 그대로 박힌다.
    expect(() => validateFile({ ...good, note: ['저티어'] })).toThrow(/note/);
  });
});

describe('buildMatch', () => {
  const file = { scrimDate: '2026-07-19', readFrom: 'Ez_A', readAt: '2026-08-10T12:00:00+09:00' };
  const match = {
    order: 1,
    map: '미라마',
    participants: [p('Ez_A', 2, { teamRank: 1 }), p('Ez_B', 0, { teamRank: 2 })],
  };
  // Ez_A 는 등록 클랜원, Ez_B 는 못 알아본 사람(탈퇴했거나 게스트)
  const resolve = (ign) => (ign === 'Ez_A' ? { memberId: 'm-1', accountId: 'account.aaa' } : null);

  it('매치 행에 dak.gg 출처를 남긴다', () => {
    const { match: row } = buildMatch(file, match, resolve);
    expect(row.source).toBe('dakgg');
    expect(row.map_name).toBe('Desert_Main');
    expect(row.match_type).toBe('custom');
    expect(row.game_mode).toBe('squad');
    expect(row.played_at).toBe('2026-07-19T20:01:00+09:00');
  });

  it('모르는 값은 지어내지 않는다', () => {
    const { match: row } = buildMatch(file, match, resolve);
    expect(row.duration_seconds).toBeNull();
  });

  it('판별 근거가 되는 수를 센다', () => {
    const { match: row } = buildMatch(file, match, resolve);
    expect(row.participant_count).toBe(2);
    expect(row.clan_member_count).toBe(1);
  });

  it('알아본 사람에게는 계정 ID 를 붙인다', () => {
    // 계정 ID 가 붙어야 0005 의 중복 제약이 작동하고,
    // 개인 지표를 낼 때 API 경기와 같은 사람으로 합쳐진다.
    const { participants } = buildMatch(file, match, resolve);
    const a = participants.find((x) => x.pubg_ign === 'Ez_A');
    expect(a.pubg_account_id).toBe('account.aaa');
    expect(a.member_id).toBe('m-1');
  });

  it('못 알아본 사람은 비워둔다', () => {
    const { participants } = buildMatch(file, match, resolve);
    const b = participants.find((x) => x.pubg_ign === 'Ez_B');
    expect(b.pubg_account_id).toBeNull();
    expect(b.member_id).toBeNull();
  });

  it('dak.gg 에 없는 지표는 0 이 아니라 NULL 이다', () => {
    // 0 으로 채우면 SQL 이 관측값으로 취급해서 평균을 절반으로 떨어뜨린다.
    const { participants } = buildMatch(file, match, resolve);
    for (const row of participants) {
      expect(row.heals).toBeNull();
      expect(row.boosts).toBeNull();
      expect(row.revives).toBeNull();
      expect(row.walk_distance).toBeNull();
      expect(row.ride_distance).toBeNull();
    }
  });

  it('이동거리 합계는 total_distance 에 넣는다', () => {
    const { participants } = buildMatch(file, match, resolve);
    expect(participants[0].total_distance).toBe(1000);
  });

  it('팀 번호가 없으니 순위를 그 자리에 쓴다', () => {
    // 한 경기 안에서 순위는 팀마다 유일하므로 식별자로 유효하다.
    const { participants } = buildMatch(file, match, resolve);
    const b = participants.find((x) => x.pubg_ign === 'Ez_B');
    expect(b.team_id).toBe(2);
    expect(b.team_rank).toBe(2);
    expect(b.win_place).toBe(2);
  });

  it('참가자가 자기 매치를 가리킨다', () => {
    const { match: row, participants } = buildMatch(file, match, resolve);
    for (const par of participants) {
      expect(par.pubg_match_id).toBe(row.pubg_match_id);
    }
  });

  it('같은 입력이면 같은 매치 ID 가 나온다', () => {
    const a = buildMatch(file, match, resolve).match.pubg_match_id;
    const b = buildMatch(file, match, resolve).match.pubg_match_id;
    expect(a).toBe(b);
  });
});
