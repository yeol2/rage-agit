import { describe, it, expect } from 'vitest';
import {
  parseRosterFile,
  tierSlot,
  buildRosterEntries,
  sortEntriesByTier,
  moveEntryToSlot,
  groupEntriesByTier,
  assignTeamNumbers,
  computeVipSort,
  type RosterEntry,
  type TeamAssignmentInput,
  type VipSortInput,
} from './scrimRoster';

describe('parseRosterFile', () => {
  it('큰따옴표로 감싼 CSV를 파싱한다', () => {
    const csv = '"User","Nickname"\n"yeol2.","Ez_Code(98)"\n"hong0551","Ez_Sugar(97)"\n';
    expect(parseRosterFile(csv)).toEqual([
      { username: 'yeol2.', nickname: 'Ez_Code(98)' },
      { username: 'hong0551', nickname: 'Ez_Sugar(97)' },
    ]);
  });

  it('따옴표 없는 TXT를 같은 함수로 파싱한다', () => {
    const txt = 'User,Nickname\nyeol2.,Ez_Code(98)\n';
    expect(parseRosterFile(txt)).toEqual([{ username: 'yeol2.', nickname: 'Ez_Code(98)' }]);
  });

  it('빈 줄과 트레일링 뉴라인을 무시한다', () => {
    const txt = 'User,Nickname\n\nyeol2.,Ez_Code(98)\n\n';
    expect(parseRosterFile(txt)).toEqual([{ username: 'yeol2.', nickname: 'Ez_Code(98)' }]);
  });

  it('Nickname 칸이 비어 있으면 null로 둔다', () => {
    const txt = 'User,Nickname\nyeol2.,\n';
    expect(parseRosterFile(txt)).toEqual([{ username: 'yeol2.', nickname: null }]);
  });

  it('헤더만 있으면 빈 배열을 낸다', () => {
    expect(parseRosterFile('User,Nickname\n')).toEqual([]);
  });

  it('완전히 빈 파일이면 빈 배열을 낸다', () => {
    expect(parseRosterFile('')).toEqual([]);
  });
});

describe('tierSlot', () => {
  it('0~1.5티어를 1티어 칸에 매핑한다', () => {
    expect(tierSlot(0)).toBe(1);
    expect(tierSlot(1)).toBe(1);
    expect(tierSlot(1.5)).toBe(1);
  });

  it('2~2.5티어를 2티어 칸에 매핑한다', () => {
    expect(tierSlot(2)).toBe(2);
    expect(tierSlot(2.5)).toBe(2);
  });

  it('3~3.5티어를 3티어 칸에 매핑한다', () => {
    expect(tierSlot(3)).toBe(3);
    expect(tierSlot(3.5)).toBe(3);
  });

  it('4~5티어를 4티어 칸에 매핑한다', () => {
    expect(tierSlot(4)).toBe(4);
    expect(tierSlot(4.5)).toBe(4);
    expect(tierSlot(5)).toBe(4);
  });
});

describe('buildRosterEntries', () => {
  const members = [
    { id: 'm1', discordUsername: 'yeol2.', tier: 3.5 },
    { id: 'm2', discordUsername: 'hong0551', tier: 2.5 },
  ];

  it('discord_username으로 매칭해 티어 칸을 채운다', () => {
    const rows = [{ username: 'yeol2.', nickname: 'Ez_Code(98)' }];
    expect(buildRosterEntries(rows, members)).toEqual([
      {
        discordUsername: 'yeol2.',
        discordNickname: 'Ez_Code(98)',
        memberId: 'm1',
        tier: 3.5,
        tierSlot: 3,
        matched: true,
      },
    ]);
  });

  it('매칭 안 되면 member/tier/tierSlot이 null이고 matched는 false다', () => {
    const rows = [{ username: 'unknown-guy', nickname: 'Ez_Unknown' }];
    expect(buildRosterEntries(rows, members)).toEqual([
      {
        discordUsername: 'unknown-guy',
        discordNickname: 'Ez_Unknown',
        memberId: null,
        tier: null,
        tierSlot: null,
        matched: false,
      },
    ]);
  });
});

describe('sortEntriesByTier', () => {
  function entry(overrides: Partial<RosterEntry>): RosterEntry {
    return {
      id: 'e1',
      discordNickname: null,
      memberId: null,
      tier: null,
      tierSlot: null,
      matched: false,
      vipRank: null,
      teamNumber: null,
      ...overrides,
    };
  }

  it('낮은 티어 숫자(상위 티어)가 먼저 오도록 오름차순 정렬한다', () => {
    const entries = [entry({ id: 'a', tier: 1.5 }), entry({ id: 'b', tier: 0 }), entry({ id: 'c', tier: 1 })];
    expect(sortEntriesByTier(entries).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('tier가 없는 항목은 뒤로 보낸다', () => {
    const entries = [entry({ id: 'a', tier: null }), entry({ id: 'b', tier: 2 })];
    expect(sortEntriesByTier(entries).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const entries = [entry({ id: 'a', tier: 2 }), entry({ id: 'b', tier: 1 })];
    sortEntriesByTier(entries);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('moveEntryToSlot', () => {
  function entry(overrides: Partial<RosterEntry>): RosterEntry {
    return {
      id: 'e1',
      discordNickname: null,
      memberId: null,
      tier: null,
      tierSlot: null,
      matched: false,
      vipRank: null,
      teamNumber: null,
      ...overrides,
    };
  }

  it('지정한 사람의 tierSlot만 바꾼다', () => {
    const entries = [entry({ id: 'a', tierSlot: 1 }), entry({ id: 'b', tierSlot: 2 })];
    const result = moveEntryToSlot(entries, 'a', 3);
    expect(result.find((e) => e.id === 'a')?.tierSlot).toBe(3);
    expect(result.find((e) => e.id === 'b')?.tierSlot).toBe(2);
  });

  it('대상을 못 찾으면 원본과 같은 내용을 돌려준다', () => {
    const entries = [entry({ id: 'a', tierSlot: 1 })];
    expect(moveEntryToSlot(entries, 'nope', 4)).toEqual(entries);
  });

  it('null로 옮기면 미매칭(티어 칸 없음) 상태가 된다', () => {
    const entries = [entry({ id: 'a', tierSlot: 2 })];
    expect(moveEntryToSlot(entries, 'a', null)[0].tierSlot).toBeNull();
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const entries = [entry({ id: 'a', tierSlot: 1 })];
    moveEntryToSlot(entries, 'a', 4);
    expect(entries[0].tierSlot).toBe(1);
  });
});

describe('groupEntriesByTier', () => {
  function entry(overrides: Partial<RosterEntry>): RosterEntry {
    return {
      id: 'e1',
      discordNickname: null,
      memberId: null,
      tier: null,
      tierSlot: null,
      matched: false,
      vipRank: null,
      teamNumber: null,
      ...overrides,
    };
  }

  it('같은 tier끼리 연속된 항목을 하나의 묶음으로 나눈다', () => {
    const sorted = [
      entry({ id: 'a', tier: 2 }),
      entry({ id: 'b', tier: 2 }),
      entry({ id: 'c', tier: 2.5 }),
    ];
    const groups = groupEntriesByTier(sorted);
    expect(groups).toEqual([
      { tier: 2, entries: [sorted[0], sorted[1]] },
      { tier: 2.5, entries: [sorted[2]] },
    ]);
  });

  it('한 티어가 하나도 없으면 그 묶음 자체가 안 생긴다', () => {
    const sorted = [entry({ id: 'a', tier: 2.5 })];
    const groups = groupEntriesByTier(sorted);
    expect(groups).toEqual([{ tier: 2.5, entries: [sorted[0]] }]);
    expect(groups.some((g) => g.tier === 2)).toBe(false);
  });

  it('빈 배열이면 빈 배열을 낸다', () => {
    expect(groupEntriesByTier([])).toEqual([]);
  });
});

describe('assignTeamNumbers', () => {
  function entry(overrides: Partial<TeamAssignmentInput>): TeamAssignmentInput {
    return { id: 'e1', tier: null, tierSlot: null, ...overrides };
  }

  it('각 티어 칸에서 tier 오름차순으로 1번팀부터 순서대로 매긴다', () => {
    const entries = [
      entry({ id: 'a', tier: 1, tierSlot: 1 }),
      entry({ id: 'b', tier: 0, tierSlot: 1 }),
      entry({ id: 'c', tier: 2, tierSlot: 2 }),
    ];
    const result = assignTeamNumbers(entries);
    expect(result.get('b')).toBe(1); // tier 0 이 먼저
    expect(result.get('a')).toBe(2);
    expect(result.get('c')).toBe(1); // 다른 티어 칸은 독립적으로 1번부터
  });

  it('같은 팀 번호는 티어 칸마다 한 명씩만 받는다(4칸이 꽉 찼을 때)', () => {
    const entries = [
      entry({ id: 'a', tier: 0, tierSlot: 1 }),
      entry({ id: 'b', tier: 2, tierSlot: 2 }),
      entry({ id: 'c', tier: 3, tierSlot: 3 }),
      entry({ id: 'd', tier: 4, tierSlot: 4 }),
    ];
    const result = assignTeamNumbers(entries);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(1);
    expect(result.get('c')).toBe(1);
    expect(result.get('d')).toBe(1);
  });

  it('tierSlot이 null인 항목은 결과에 안 들어간다', () => {
    const entries = [entry({ id: 'a', tier: null, tierSlot: null })];
    expect(assignTeamNumbers(entries).has('a')).toBe(false);
  });

  it('빈 배열이면 빈 맵을 낸다', () => {
    expect(assignTeamNumbers([]).size).toBe(0);
  });
});

describe('computeVipSort', () => {
  function entry(overrides: Partial<VipSortInput>): VipSortInput {
    return { id: 'e1', tierSlot: null, teamNumber: null, vipRank: null, ...overrides };
  }

  it('참가 중인 VIP를 등수 오름차순으로 1번팀부터 채워지게 스왑한다', () => {
    // 2등 VIP(a)가 2티어 5번팀에, 6등 VIP(b)가 1티어 9번팀에 있다고 하자.
    // 정렬 후: a → 2티어 1번팀(원래 1번팀에 있던 c와 맞바뀜),
    //          b → 1티어 2번팀(원래 2번팀에 있던 d와 맞바뀜).
    const entries = [
      entry({ id: 'a', tierSlot: 2, teamNumber: 5, vipRank: 2 }),
      entry({ id: 'b', tierSlot: 1, teamNumber: 9, vipRank: 6 }),
      entry({ id: 'c', tierSlot: 2, teamNumber: 1 }),
      entry({ id: 'd', tierSlot: 1, teamNumber: 2 }),
    ];
    const changes = computeVipSort(entries);
    expect(changes.get('a')).toBe(1);
    expect(changes.get('c')).toBe(5);
    expect(changes.get('b')).toBe(2);
    expect(changes.get('d')).toBe(9);
  });

  it('참가 중인 VIP가 없으면 빈 맵을 낸다', () => {
    const entries = [entry({ id: 'a', tierSlot: 1, teamNumber: 1, vipRank: null })];
    expect(computeVipSort(entries).size).toBe(0);
  });

  it('이미 등수 순으로 정렬돼 있으면 아무것도 안 바뀐다(멱등)', () => {
    const entries = [
      entry({ id: 'a', tierSlot: 1, teamNumber: 1, vipRank: 2 }),
      entry({ id: 'b', tierSlot: 3, teamNumber: 2, vipRank: 6 }),
    ];
    expect(computeVipSort(entries).size).toBe(0);
  });

  it('팀 번호가 아직 없는(보류) 항목은 무시한다', () => {
    const entries = [entry({ id: 'a', tierSlot: null, teamNumber: null, vipRank: 1 })];
    expect(computeVipSort(entries).size).toBe(0);
  });
});
