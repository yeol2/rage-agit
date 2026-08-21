import { describe, expect, it } from 'vitest';
import { countdownParts, formatCountdown, nextScrimDate } from './nextScrim';

// 2026-08-17(월) 그 주 목요일은 20일, 일요일은 23일, 다음 목요일은 27일.
// UTC ISO(...Z)로 명시해서 테스트 실행 환경의 로컬 시간대와 무관하게 만든다 —
// KST 19:30 = UTC 10:30.
describe('nextScrimDate', () => {
  it('월요일이면 그 주 목요일 19:30 KST 를 반환한다', () => {
    const result = nextScrimDate(new Date('2026-08-17T01:00:00Z'));
    expect(result.toISOString()).toBe('2026-08-20T10:30:00.000Z');
  });

  it('목요일 시작 전이면 당일 19:30 KST 를 반환한다', () => {
    const result = nextScrimDate(new Date('2026-08-20T03:00:00Z')); // KST 정오
    expect(result.toISOString()).toBe('2026-08-20T10:30:00.000Z');
  });

  it('목요일 시작 후면 그 주 일요일로 넘어간다', () => {
    const result = nextScrimDate(new Date('2026-08-20T12:00:00Z')); // KST 21시
    expect(result.toISOString()).toBe('2026-08-23T10:30:00.000Z');
  });

  it('일요일 시작 후면 다음 주 목요일로 넘어간다', () => {
    const result = nextScrimDate(new Date('2026-08-23T12:00:00Z')); // KST 21시
    expect(result.toISOString()).toBe('2026-08-27T10:30:00.000Z');
  });

  it('목·일 사이 평일(금·토)에는 그 주 일요일을 가리킨다', () => {
    const friday = nextScrimDate(new Date('2026-08-21T09:00:00Z'));
    expect(friday.toISOString()).toBe('2026-08-23T10:30:00.000Z');

    const saturday = nextScrimDate(new Date('2026-08-22T09:00:00Z'));
    expect(saturday.toISOString()).toBe('2026-08-23T10:30:00.000Z');
  });

  it('KST 자정 근처(UTC 로는 전날)라도 KST 요일 기준으로 계산한다', () => {
    // UTC 2026-08-19T16:00:00Z = KST 2026-08-20T01:00(목요일 새벽).
    const result = nextScrimDate(new Date('2026-08-19T16:00:00Z'));
    expect(result.toISOString()).toBe('2026-08-20T10:30:00.000Z');
  });
});

describe('countdownParts', () => {
  it('남은 시간을 일/시/분/초로 쪼갠다', () => {
    const from = new Date('2026-08-17T10:00:00');
    const target = new Date('2026-08-20T19:30:45');
    expect(countdownParts(target, from)).toEqual({
      days: 3,
      hours: 9,
      minutes: 30,
      seconds: 45,
    });
  });

  it('이미 지난 시각이면 전부 0 이다', () => {
    const from = new Date('2026-08-21T10:00:00');
    const target = new Date('2026-08-20T19:30:00');
    expect(countdownParts(target, from)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('formatCountdown', () => {
  it('하루 이상 남으면 d/h/m/s 를 모두 적는다', () => {
    const from = new Date('2026-08-17T10:00:00');
    const target = new Date('2026-08-20T19:30:45');
    expect(formatCountdown(target, from)).toBe('3d 9h 30m 45s');
  });

  it('하루 미만이면 앞자리(d)를 생략한다', () => {
    const from = new Date('2026-08-20T17:00:00');
    const target = new Date('2026-08-20T19:30:20');
    expect(formatCountdown(target, from)).toBe('2h 30m 20s');
  });

  it('한 시간 미만이면 d 와 h 를 모두 생략한다', () => {
    const from = new Date('2026-08-20T19:00:00');
    const target = new Date('2026-08-20T19:30:05');
    expect(formatCountdown(target, from)).toBe('30m 5s');
  });
});
