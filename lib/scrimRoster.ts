// 팀 구성 테이블 — 순수 계산 함수는 여기 위쪽, 네트워크 호출은 이 파일 뒷부분에만
// 있다(lib/memberStats.ts 와 같은 패턴). 위쪽은 Supabase 없이 테스트한다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 대시보드/클랜원 페이지가 쓰는 공용 lib/supabaseBrowser.ts 의 getSupabase() 는 일부러
// 캐시(revalidate=300)를 기대하고 쓰인다 — 이 화면은 반대로 관리자가 업로드하면
// 바로 최신 값을 봐야 해서, fetch 자체에 no-store 를 강제하는 별도 클라이언트를 쓴다.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: 'no-store' });
}

let freshClient: SupabaseClient | null = null;
function getFreshSupabase(): SupabaseClient {
  if (freshClient) return freshClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다');
  }

  freshClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
  return freshClient;
}

export interface ParsedRosterRow {
  username: string;
  nickname: string | null;
}

// CSV(큰따옴표로 감쌈)와 TXT(안 감쌈)를 같은 함수로 처리한다.
// 따옴표가 아예 없는 줄은 inQuotes 가 한 번도 안 켜지므로 그냥 콤마 분리와 같다.
function splitDelimitedLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseRosterFile(text: string): ParsedRosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  return lines
    .slice(1) // 헤더(User,Nickname) 건너뛴다
    .map((line) => {
      const [username, nickname] = splitDelimitedLine(line);
      return {
        username: (username ?? '').trim(),
        nickname: nickname && nickname.trim() ? nickname.trim() : null,
      };
    })
    .filter((row) => row.username.length > 0);
}

// 이 클랜은 0티어가 최상위. 0~1.5→1티어, 2~2.5→2티어, 3~3.5→3티어, 4~5→4티어 칸.
// 16명 미달/초과 보정은 여기서 하지 않는다 — 2단계에서 사람이 손으로 조정한다.
export function tierSlot(tier: number): 1 | 2 | 3 | 4 {
  if (tier <= 1.5) return 1;
  if (tier <= 2.5) return 2;
  if (tier <= 3.5) return 3;
  return 4;
}

export interface MemberForMatching {
  id: string;
  discordUsername: string;
  tier: number;
}

export interface RosterEntryInput {
  discordUsername: string;
  discordNickname: string | null;
  memberId: string | null;
  tier: number | null;
  tierSlot: 1 | 2 | 3 | 4 | null;
  matched: boolean;
}

export function buildRosterEntries(
  rows: ParsedRosterRow[],
  members: MemberForMatching[],
): RosterEntryInput[] {
  const memberByUsername = new Map(members.map((m) => [m.discordUsername, m]));

  return rows.map((row) => {
    const member = memberByUsername.get(row.username);
    if (!member) {
      return {
        discordUsername: row.username,
        discordNickname: row.nickname,
        memberId: null,
        tier: null,
        tierSlot: null,
        matched: false,
      };
    }
    return {
      discordUsername: row.username,
      discordNickname: row.nickname,
      memberId: member.id,
      tier: member.tier,
      tierSlot: tierSlot(member.tier),
      matched: true,
    };
  });
}

export interface RosterEntry {
  id: string;
  discordNickname: string | null;
  memberId: string | null;
  tier: number | null;
  tierSlot: 1 | 2 | 3 | 4 | null;
  matched: boolean;
}

export interface Roster {
  id: string;
  fetchedAt: string;
  entries: RosterEntry[];
}

// discord_username 은 anon 키로 못 읽으므로(0016 마이그레이션) 여기서 select 하지
// 않는다 — 화면에는 discord_nickname 만 보여준다.
export async function fetchLatestRoster(): Promise<Roster | null> {
  const { data: rosterRow, error: rosterError } = await getFreshSupabase()
    .from('scrim_rosters')
    .select('id, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rosterError) throw new Error(`팀 구성 명단을 불러오지 못했습니다: ${rosterError.message}`);
  if (!rosterRow) return null;

  const { data: entriesData, error: entriesError } = await getFreshSupabase()
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched')
    .eq('roster_id', rosterRow.id);
  if (entriesError) throw new Error(`팀 구성 명단을 불러오지 못했습니다: ${entriesError.message}`);

  return {
    id: rosterRow.id,
    fetchedAt: rosterRow.fetched_at,
    entries: (entriesData ?? []).map((row) => ({
      id: row.id,
      discordNickname: row.discord_nickname,
      memberId: row.member_id,
      tier: row.tier,
      tierSlot: row.tier_slot,
      matched: row.matched,
    })),
  };
}
