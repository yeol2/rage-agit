import { describe, expect, it } from 'vitest';
import { formatRegisterFailAlert, formatRunAlert, runAlertReasons } from './reactionAlert';

describe('runAlertReasons', () => {
  it('alerts when a run beats the current first place', () => {
    expect(runAlertReasons([144, 154, 141, 140, 133], 145, null)).toEqual(['현재 1등(145ms)보다 빠름']);
  });

  it('stays quiet for an ordinary run slower than first place', () => {
    expect(runAlertReasons([241, 268, 225, 290, 252], 141, null)).toEqual([]);
  });

  it('alerts for runs blocked by the anti-cheat rules', () => {
    expect(runAlertReasons([118, 116, 119, 108, 111], 141, '평균...')).toContain('평균 130ms 미만(등록 막힘)');
    expect(runAlertReasons([230, 230, 231, 228, 234], 141, '매크로...')).toContain('매크로 의심 — 편차 4ms 미만(등록 막힘)');
  });
});

describe('alert messages', () => {
  it('says who (saved nickname), the times, run number and why', () => {
    const msg = formatRunAlert({
      times: [144, 154, 141, 140, 133],
      reasons: ['현재 1등(145ms)보다 빠름'],
      savedNickname: 'Ez_Code',
      tryNumber: 37,
      mistakes: 5,
    });
    expect(msg).toContain('Ez\\_Code');
    expect(msg).toContain('144 / 154 / 141 / 140 / 133');
    expect(msg).toContain('37번째 판');
    expect(msg).toContain('현재 1등(145ms)보다 빠름');
  });

  it('marks an unknown player when no nickname is saved', () => {
    const msg = formatRunAlert({ times: [144, 154, 141, 140, 133], reasons: ['x'], savedNickname: null, tryNumber: null, mistakes: null });
    expect(msg).toContain('알 수 없음');
  });

  it('reports a failed registration with the typed nickname and reason', () => {
    const msg = formatRegisterFailAlert({ nickname: 'Ez_Code', error: '내전 비밀번호가 틀렸습니다.', times: [131, 142, 133, 147, 129] });
    expect(msg).toContain('등록 실패');
    expect(msg).toContain('Ez\\_Code');
    expect(msg).toContain('내전 비밀번호가 틀렸습니다.');
  });
});
