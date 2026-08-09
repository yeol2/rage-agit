import { describe, expect, it } from 'vitest';
import { scrimSessionTitle, toKstDate } from './sessions.mjs';

describe('toKstDate', () => {
  it('UTC 저녁 매치를 같은 날 한국시간 날짜로 준다', () => {
    // 실측: 08-09 내전은 UTC 10:59~12:38 = 한국시간 19:59~21:38
    expect(toKstDate('2026-08-09T10:59:41Z')).toBe('2026-08-09');
    expect(toKstDate('2026-08-09T12:38:09Z')).toBe('2026-08-09');
  });

  it('UTC 로 날짜가 넘어가도 한국시간 날짜로 묶는다', () => {
    // UTC 15:00 이후는 한국시간으로 다음 날이다.
    expect(toKstDate('2026-08-09T15:30:00Z')).toBe('2026-08-10');
    expect(toKstDate('2026-08-09T23:00:00Z')).toBe('2026-08-10');
  });

  it('UTC 자정 직후도 한국시간 기준으로는 같은 날이다', () => {
    // 한국시간 09:00 — 전날 밤 늦게 시작한 내전이 여기까지 이어질 일은 없지만,
    // 날짜 경계를 UTC 가 아니라 KST 로 잡는다는 것을 고정해둔다.
    expect(toKstDate('2026-08-10T00:30:00Z')).toBe('2026-08-10');
  });

  it('타임존 표기가 +00:00 이어도 같게 다룬다', () => {
    // Supabase 가 돌려주는 형식이 이렇다.
    expect(toKstDate('2026-08-09T12:38:09+00:00')).toBe('2026-08-09');
  });
});

describe('scrimSessionTitle', () => {
  it('날짜와 요일을 붙인 제목을 만든다', () => {
    expect(scrimSessionTitle('2026-08-09')).toBe('2026-08-09 (일) 내전');
    expect(scrimSessionTitle('2026-08-02')).toBe('2026-08-02 (일) 내전');
  });

  it('목요일 내전도 요일을 맞게 붙인다', () => {
    // 내전은 목·일 주 2회다.
    expect(scrimSessionTitle('2026-08-06')).toBe('2026-08-06 (목) 내전');
  });
});
