import { describe, it, expect } from 'vitest';
import { parseRosterFile, tierSlot, buildRosterEntries } from './scrimRoster';

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
