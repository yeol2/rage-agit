import { describe, expect, it } from 'vitest';
import { countdownParts, formatCountdown, nextScrimDate } from './nextScrim';

// 2026-08-17 은 월요일. 그 주의 목요일은 20일, 금요일은 21일.
describe('nextScrimDate', () => {
  it('월요일이면 그 주 목요일 19:30 을 반환한다', () => {
    const result = nextScrimDate(new Date('2026-08-17T10:00:00'));
    expect(result.getDay()).toBe(4);
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(19);
    expect(result.getMinutes()).toBe(30);
  });

  it('목요일 시작 전이면 당일 19:30 을 반환한다', () => {
    const result = nextScrimDate(new Date('2026-08-20T12:00:00'));
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(19);
  });

  it('목요일 시작 후면 다음 날 금요일로 넘어간다', () => {
    const result = nextScrimDate(new Date('2026-08-20T20:00:00'));
    expect(result.getDay()).toBe(5);
    expect(result.getDate()).toBe(21);
  });

  it('금요일 시작 후면 다음 주 목요일로 넘어간다', () => {
    const result = nextScrimDate(new Date('2026-08-21T20:00:00'));
    expect(result.getDay()).toBe(4);
    expect(result.getDate()).toBe(27);
  });

  it('주말·초반 평일에는 그 주 목요일을 가리킨다', () => {
    const saturday = nextScrimDate(new Date('2026-08-22T09:00:00'));
    expect(saturday.getDay()).toBe(4);
    expect(saturday.getDate()).toBe(27);
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
