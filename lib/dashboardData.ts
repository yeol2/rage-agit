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

export function getRecentScrims(sessions: ScrimSession[], limit = 10): ScrimSession[] {
  return [...sessions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatScrimDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return `${dateISO} (${KOREAN_WEEKDAYS[utcDate.getUTCDay()]})`;
}

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
