import { describe, expect, it } from 'vitest';
import {
  centeredPercent,
  medalRank,
  standingsByMember,
  stddev,
  type SessionStanding,
} from './memberDashboard';

describe('centeredPercent', () => {
  it('그룹 평균이면 정확히 한가운데다 — 링 게이지의 50점 자리와 같은 뜻', () => {
    expect(centeredPercent(6.9, 6.9, 2, true)).toBe(50);
    expect(centeredPercent(6.9, 6.9, 2, false)).toBe(50);
  });

  it('평균보다 좋으면 오른쪽으로 간다 (등수는 숫자가 작을수록 좋다)', () => {
    expect(centeredPercent(4.9, 6.9, 4, false)).toBe(75);
    expect(centeredPercent(8.9, 6.9, 4, false)).toBe(25);
  });

  it('평균킬은 숫자가 클수록 좋다', () => {
    expect(centeredPercent(3.0, 2.0, 2, true)).toBe(75);
    expect(centeredPercent(1.0, 2.0, 2, true)).toBe(25);
  });

  it('양 끝을 4~96%로 묶는다 — 0%는 "기록 없음"으로 오해된다', () => {
    expect(centeredPercent(100, 2, 1, true)).toBe(96);
    expect(centeredPercent(-100, 2, 1, true)).toBe(4);
  });

  it('그룹이 전원 동점이면(표준편차 0) 한가운데로 둔다', () => {
    expect(centeredPercent(5, 5, 0, true)).toBe(50);
  });
});

describe('medalRank', () => {
  it('1~3위만 메달이고 나머지는 없다', () => {
    expect(medalRank(1)).toBe(1);
    expect(medalRank(3)).toBe(3);
    expect(medalRank(4)).toBeNull();
    expect(medalRank(16)).toBeNull();
  });
});

describe('standingsByMember', () => {
  it('사람별로 날짜→등수 표를 만든다', () => {
    const rows: SessionStanding[] = [
      { memberId: 'a', scrimDate: '2026-08-23', standing: 1 },
      { memberId: 'a', scrimDate: '2026-08-20', standing: 7 },
      { memberId: 'b', scrimDate: '2026-08-23', standing: 12 },
    ];
    const byMember = standingsByMember(rows);
    expect(byMember.get('a')?.get('2026-08-23')).toBe(1);
    expect(byMember.get('a')?.get('2026-08-20')).toBe(7);
    expect(byMember.get('b')?.get('2026-08-23')).toBe(12);
    // 안 나온 회차는 아예 없다 — 화면은 이걸 '-' 로 그린다.
    expect(byMember.get('b')?.get('2026-08-20')).toBeUndefined();
  });
});

describe('stddev', () => {
  it('평균에서 퍼진 정도를 낸다', () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9], 5)).toBe(2);
  });
});
