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
  // 매칭된 클랜원이 VIP면 그 등수 — 네임플레이트에 왕관을 띄울지 판단하는 데 쓴다.
  // 클랜원 명단(members)에서 조인해 온 값이라 roster 테이블 자체에는 없다.
  vipRank: number | null;
  // "팀 구성" 버튼을 눌러 배정된 팀 번호. 배정 전에는 null.
  teamNumber: number | null;
}

export interface Roster {
  id: string;
  fetchedAt: string;
  entries: RosterEntry[];
}

// 화면(RosterBoard)의 티어 칸 안에서 기본 정렬 순서 — 이 클랜은 0티어가 최상위라
// 숫자가 작을수록 상위 티어다. 오름차순으로 정렬해 실력 순으로 보이게 한다.
// tier 가 없는 항목(미매칭)은 뒤로 보낸다.
export function sortEntriesByTier(entries: RosterEntry[]): RosterEntry[] {
  return [...entries].sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity));
}

// 드래그 앤 드롭으로 한 사람을 다른 티어 칸(1~4)이나 미매칭(null)으로 옮긴다 —
// 16명 미달/초과를 사람이 손으로 맞추는 용도. 대상을 못 찾으면 원본을 그대로
// 돌려준다(방어적).
export function moveEntryToSlot(
  entries: RosterEntry[],
  entryId: string,
  targetSlot: 1 | 2 | 3 | 4 | null,
): RosterEntry[] {
  return entries.map((entry) => (entry.id === entryId ? { ...entry, tierSlot: targetSlot } : entry));
}

export interface TierGroup {
  tier: number | null;
  entries: RosterEntry[];
}

// 한 티어 칸(예: "2티어 (2~2.5)")은 실제로는 여러 실제 티어(2, 2.5)를 섞어서 담고
// 있어서, 그 안에서도 몇 티어인지 구분되도록 실제 tier 값별로 나눈다. 인원이 다른
// 칸으로 다 빠지면 그 묶음 자체가 사라지고(입력이 이미 sortEntriesByTier로 정렬돼
// 있다고 가정 — 같은 tier 는 항상 붙어 있다), 누가 다시 들어오면 다시 생긴다 —
// 화면이 매번 이 함수로 다시 계산하기 때문에 별도로 "숨김" 상태를 관리할 필요가 없다.
export function groupEntriesByTier(sortedEntries: RosterEntry[]): TierGroup[] {
  const groups: TierGroup[] = [];
  for (const entry of sortedEntries) {
    const last = groups[groups.length - 1];
    if (last && last.tier === entry.tier) {
      last.entries.push(entry);
    } else {
      groups.push({ tier: entry.tier, entries: [entry] });
    }
  }
  return groups;
}

export interface TeamAssignmentInput {
  id: string;
  tier: number | null;
  tierSlot: 1 | 2 | 3 | 4 | null;
}

// "팀 구성" 버튼을 누르면 01의 각 티어 칸에 보이는 순서(실제 티어 오름차순) 그대로
// 1번팀부터 차례로 매긴다. 네 칸 모두 인원수가 같다는 전제(호출하는 쪽에서 검증)
// 하에 각 팀은 티어별로 정확히 한 명씩 받는다.
export function assignTeamNumbers(entries: TeamAssignmentInput[]): Map<string, number> {
  const teamNumberById = new Map<string, number>();
  for (const slot of [1, 2, 3, 4] as const) {
    const slotEntries = entries
      .filter((entry) => entry.tierSlot === slot)
      .sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity));
    slotEntries.forEach((entry, index) => teamNumberById.set(entry.id, index + 1));
  }
  return teamNumberById;
}

export interface VipSortInput {
  id: string;
  tierSlot: 1 | 2 | 3 | 4 | null;
  teamNumber: number | null;
  vipRank: number | null;
}

// "VIP 정렬" 버튼 — 내전에 참가 중인(팀 번호가 이미 배정된) VIP를 등수 오름차순으로
// 1번팀부터 채워지도록 자기 티어 칼럼 안에서 스왑한다. i번째(0-based) VIP는
// (i+1)번팀 자리와 맞바뀐다 — 원래 그 자리에 있던 사람은 그 VIP가 있던 팀 번호로
// 옮겨가므로 아무도 빠지지 않는다. 이미 정렬돼 있으면 반환하는 맵이 비어 있다(멱등).
export function computeVipSort(entries: VipSortInput[]): Map<string, number> {
  const assigned = entries.filter(
    (entry): entry is VipSortInput & { tierSlot: 1 | 2 | 3 | 4; teamNumber: number } =>
      entry.tierSlot !== null && entry.teamNumber !== null,
  );

  // (티어 칼럼, 팀 번호) 자리에 지금 누가 있는지 — 스왑하면서 계속 갱신한다.
  const occupantByKey = new Map<string, VipSortInput>();
  const teamNumberById = new Map<string, number>();
  for (const entry of assigned) {
    occupantByKey.set(`${entry.tierSlot}-${entry.teamNumber}`, entry);
    teamNumberById.set(entry.id, entry.teamNumber);
  }

  const participatingVips = assigned
    .filter((entry) => entry.vipRank !== null)
    .sort((a, b) => (a.vipRank as number) - (b.vipRank as number));

  participatingVips.forEach((vip, index) => {
    const targetTeam = index + 1;
    const currentTeam = teamNumberById.get(vip.id) as number;
    if (currentTeam === targetTeam) return;

    const targetKey = `${vip.tierSlot}-${targetTeam}`;
    const occupant = occupantByKey.get(targetKey);

    if (occupant && occupant.id !== vip.id) {
      teamNumberById.set(occupant.id, currentTeam);
      occupantByKey.set(`${vip.tierSlot}-${currentTeam}`, occupant);
    }

    teamNumberById.set(vip.id, targetTeam);
    occupantByKey.set(targetKey, vip);
  });

  const changes = new Map<string, number>();
  for (const entry of assigned) {
    const newTeamNumber = teamNumberById.get(entry.id) as number;
    if (newTeamNumber !== entry.teamNumber) changes.set(entry.id, newTeamNumber);
  }
  return changes;
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

  // members(vip_rank) 는 member_id 외래키를 타고 오는 조인이다 — VIP 왕관을 띄울지
  // 판단하는 데만 쓴다. 수동 추가한 사람은 member_id 가 없어 자연스럽게 null 이 된다.
  const { data: entriesData, error: entriesError } = await getFreshSupabase()
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, members(vip_rank)')
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
      teamNumber: row.team_number,
      // PostgREST 는 관계를 배열로 내려줄 수도, 단일 객체로 내려줄 수도 있다
      // (여기선 다대일이라 실제로는 객체 하나) — 양쪽 다 받아둔다.
      vipRank: (Array.isArray(row.members) ? row.members[0] : row.members)?.vip_rank ?? null,
    })),
  };
}
