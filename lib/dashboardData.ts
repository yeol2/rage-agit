export interface Member {
  id: string;
  ign: string;
  tier: number;
  score: number;
}

export interface ScrimSession {
  id: string;
  title: string;
  date: string;
  participantCount: number;
  matchCount: number;
  replayUrl: string | null;
}

export interface TierGroup {
  id: string;
  label: string;
  tiers: number[] | null;
}

export const TIER_GROUPS: TierGroup[] = [
  { id: 'all', label: '전체', tiers: null },
  { id: '0-1.5', label: '0~1.5티어', tiers: [0, 1, 1.5] },
  { id: '2-2.5', label: '2~2.5티어', tiers: [2, 2.5] },
  { id: '3-3.5', label: '3~3.5티어', tiers: [3, 3.5] },
  { id: '4-4.5', label: '4~4.5티어', tiers: [4, 4.5] },
];

export function getTopMembers(members: Member[], group: TierGroup, limit = 3): Member[] {
  const filtered =
    group.tiers === null
      ? members
      : members.filter((member) => group.tiers!.includes(member.tier));
  return [...filtered].sort((a, b) => b.score - a.score).slice(0, limit);
}

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatScrimDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return `${dateISO} (${KOREAN_WEEKDAYS[utcDate.getUTCDay()]})`;
}

export const MEMBERS: Member[] = [
  { id: 'm01', ign: '아지트지킴이', tier: 0, score: 62.4 },
  { id: 'm02', ign: '초보헌터', tier: 1, score: 58.1 },
  { id: 'm03', ign: '느긋한스나', tier: 1.5, score: 71.3 },
  { id: 'm04', ign: '풀숲매복', tier: 0, score: 49.7 },
  { id: 'm05', ign: '연습생라이언', tier: 1, score: 65.0 },
  { id: 'm06', ign: '침착한저격수', tier: 2, score: 88.2 },
  { id: 'm07', ign: '질주하는탱커', tier: 2.5, score: 92.6 },
  { id: 'm08', ign: '한타장인', tier: 2, score: 79.4 },
  { id: 'm09', ign: '벽뚫는딜러', tier: 2.5, score: 85.1 },
  { id: 'm10', ign: '고요한추격자', tier: 2, score: 74.8 },
  { id: 'm11', ign: '번개같은컨트롤', tier: 2.5, score: 90.0 },
  { id: 'm12', ign: '냉철한지휘관', tier: 3, score: 101.5 },
  { id: 'm13', ign: '섬광탄장인', tier: 3.5, score: 108.2 },
  { id: 'm14', ign: '전선붕괴자', tier: 3, score: 96.7 },
  { id: 'm15', ign: '유령저격', tier: 3.5, score: 103.9 },
  { id: 'm16', ign: '완벽한로테이션', tier: 3, score: 99.1 },
  { id: 'm17', ign: '레이지에이스', tier: 4.5, score: 128.4 },
];

export const SCRIM_SESSIONS: ScrimSession[] = [
  {
    id: 'scrim-18',
    title: '2026 RAGE 클랜내전 #18',
    date: '2026-08-02',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-18',
  },
  {
    id: 'scrim-17',
    title: '2026 RAGE 클랜내전 #17',
    date: '2026-07-26',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-17',
  },
  {
    id: 'scrim-16',
    title: '2026 RAGE 클랜내전 #16',
    date: '2026-07-19',
    participantCount: 60,
    matchCount: 4,
    replayUrl: null,
  },
  {
    id: 'scrim-15',
    title: '2026 RAGE 클랜내전 #15',
    date: '2026-07-12',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-15',
  },
  {
    id: 'scrim-14',
    title: '2026 RAGE 클랜내전 #14',
    date: '2026-07-05',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-14',
  },
  {
    id: 'scrim-13',
    title: '2026 RAGE 클랜내전 #13',
    date: '2026-06-28',
    participantCount: 64,
    matchCount: 3,
    replayUrl: null,
  },
  {
    id: 'scrim-12',
    title: '2026 RAGE 클랜내전 #12',
    date: '2026-06-21',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-12',
  },
  {
    id: 'scrim-11',
    title: '2026 RAGE 클랜내전 #11',
    date: '2026-06-14',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-11',
  },
  {
    id: 'scrim-10',
    title: '2026 RAGE 클랜내전 #10',
    date: '2026-06-07',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-10',
  },
  {
    id: 'scrim-9',
    title: '2026 RAGE 클랜내전 #9',
    date: '2026-05-31',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-9',
  },
];
