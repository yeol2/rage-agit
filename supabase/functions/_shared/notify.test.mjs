import { describe, expect, it } from 'vitest';
import { formatFailureMessage, formatPollingMessage } from './notify.mjs';

describe('formatPollingMessage', () => {
  it('내전을 찾으면 날짜와 인원을 알린다', () => {
    const message = formatPollingMessage(
      {
        scrimsFound: 4,
        scrims: [
          { playedAt: '2026-08-09T10:59:41Z', participantCount: 64, clanMemberCount: 64 },
          { playedAt: '2026-08-09T11:34:18Z', participantCount: 64, clanMemberCount: 64 },
          { playedAt: '2026-08-09T12:05:59Z', participantCount: 64, clanMemberCount: 64 },
          { playedAt: '2026-08-09T12:38:09Z', participantCount: 64, clanMemberCount: 64 },
        ],
        unregistered: new Map(),
        truncated: false,
        matchesExamined: 40,
      },
      { sinceHours: 24 },
    );
    expect(message).toContain('4경기');
    expect(message).toContain('64');
  });

  it('한국시간으로 보여준다', () => {
    // UTC 10:59 는 한국시간 19:59 다. UTC 로 적으면 날짜가 헷갈린다.
    const message = formatPollingMessage(
      {
        scrimsFound: 1,
        scrims: [{ playedAt: '2026-08-09T10:59:41Z', participantCount: 64, clanMemberCount: 64 }],
        unregistered: new Map(),
        truncated: false,
        matchesExamined: 40,
      },
      { sinceHours: 24 },
    );
    expect(message).toContain('19:59');
  });

  it('미등록 참가자를 알린다 — 명단을 고치라는 신호다', () => {
    const message = formatPollingMessage(
      {
        scrimsFound: 1,
        scrims: [{ playedAt: '2026-08-09T10:59:41Z', participantCount: 64, clanMemberCount: 63 }],
        unregistered: new Map([['Ez_HxxJxx', 1]]),
        truncated: false,
        matchesExamined: 40,
      },
      { sinceHours: 24 },
    );
    expect(message).toContain('Ez_HxxJxx');
  });

  it('내전이 없으면 아무것도 보내지 않는다', () => {
    // 내전 없는 날이 정상이라, 매번 알리면 알림이 무뎌진다.
    const message = formatPollingMessage(
      { scrimsFound: 0, scrims: [], unregistered: new Map(), truncated: false, matchesExamined: 12 },
      { sinceHours: 24 },
    );
    expect(message).toBeNull();
  });

  it('상한에 걸렸으면 내전이 없어도 알린다', () => {
    const message = formatPollingMessage(
      { scrimsFound: 0, scrims: [], unregistered: new Map(), truncated: true, matchesExamined: 200 },
      { sinceHours: 24 },
    );
    expect(message).toContain('상한');
  });
});

describe('formatFailureMessage', () => {
  it('에러와 만회 방법을 함께 알린다', () => {
    const message = formatFailureMessage(new Error('Players API 오류 503'), { sinceHours: 24 });
    expect(message).toContain('503');
    expect(message).toContain('--since-hours=336');
  });
});
