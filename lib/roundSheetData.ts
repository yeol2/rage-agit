import type { SupabaseClient } from '@supabase/supabase-js';
// 내전 날짜를 한국시간으로 묶는 규칙은 폴링(Edge Function)과 같아야 한다 —
// 어긋나면 같은 내전이 두 날짜로 갈린다. 그래서 그쪽 모듈을 그대로 쓴다.
import { toKstDate } from '@/supabase/functions/_shared/sessions.mjs';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  deriveSquadsFromMatches,
  type MatchParticipantForSquads,
  type RoundParticipant,
  type RosterMemberForScoring,
  type RoundSheetRow,
} from '@/lib/roundSheet';

export interface RoundSheetTeam extends RoundSheetRow {
  players: string[];
  /** 이 팀에 실제로 뛴 클랜원. 우승 확정이 누구에게 기록할지 정할 때 쓴다. */
  memberIds: string[];
}

export interface RoundSheetData {
  /** 이 로스터가 속한 내전 세션의 한국시간 날짜. 세션이 아직 없으면 null 이다. */
  scrimDate: string | null;
  roundCount: number;
  teams: RoundSheetTeam[];
}

/**
 * 03 내전 시트 한 장을 만든다.
 *
 * 시트를 보여줄 때(GET)와 우승을 확정할 때(POST)가 **같은 값을 봐야 하므로**
 * 계산은 여기 한 곳에만 둔다. 확정 쪽이 클라이언트가 보낸 우승팀을 그대로
 * 믿지 않고 서버에서 다시 구하는 것도 이 때문이다.
 */
export async function buildRoundSheet(
  supabase: SupabaseClient,
  rosterId: string,
): Promise<RoundSheetData> {
  const { data: entryRows, error: entriesError } = await supabase
    .from('scrim_roster_entries')
    .select('discord_nickname, tier_slot, team_number')
    .eq('roster_id', rosterId)
    .not('team_number', 'is', null)
    .order('tier_slot', { ascending: true });
  if (entriesError) throw new Error('로스터를 불러오지 못했습니다.');

  const teamNumbers = [...new Set((entryRows ?? []).map((row) => row.team_number as number))].sort(
    (a, b) => a - b,
  );
  const playersByTeam = new Map<number, string[]>();
  for (const row of entryRows ?? []) {
    const teamNumber = row.team_number as number;
    const list = playersByTeam.get(teamNumber) ?? [];
    list.push((row.discord_nickname as string | null) ?? '(닉네임 정보 없음)');
    playersByTeam.set(teamNumber, list);
  }

  const { data: rosterRow, error: rosterFetchError } = await supabase
    .from('scrim_rosters')
    .select('fetched_at')
    .eq('id', rosterId)
    .maybeSingle();
  if (rosterFetchError || !rosterRow) throw new Error('로스터를 불러오지 못했습니다.');

  const scrimDate = toKstDate(rosterRow.fetched_at as string);

  const { data: session, error: sessionError } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('scrim_date', scrimDate)
    .maybeSingle();
  if (sessionError) throw new Error('내전 세션을 조회하지 못했습니다.');

  // 아직 경기가 하나도 안 잡혔으면 팀 번호만 있는 빈 시트를 준다.
  const emptySheet = (): RoundSheetData => ({
    scrimDate: session ? scrimDate : null,
    roundCount: 0,
    teams: computeRoundSheet([], teamNumbers).map((row) => ({
      ...row,
      players: playersByTeam.get(row.teamNumber) ?? [],
      memberIds: [],
    })),
  });

  if (!session) return emptySheet();

  // excluded_reason 이 붙은 매치(재경기 등)는 라운드로 세지 않는다. 이걸 안
  // 걸러내면 2026-08-16 처럼 재경기가 4번째 자리를 차지해서, limit(4) 에
  // 진짜 마지막 라운드가 잘려나간다.
  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('pubg_match_id')
    .eq('scrim_session_id', session.id)
    .is('excluded_reason', null)
    .order('played_at', { ascending: true })
    .limit(4);
  if (matchesError) throw new Error('매치 목록을 불러오지 못했습니다.');
  if (!matchRows || matchRows.length === 0) return emptySheet();

  const matchParticipants: {
    memberId: string | null;
    kills: number;
    teamRank: number;
    teamId: number;
  }[][] = [];
  for (const match of matchRows) {
    const { data: participantRows, error: participantsError } = await supabase
      .from('match_participants')
      .select('member_id, kills, team_rank, team_id')
      .eq('pubg_match_id', match.pubg_match_id);
    if (participantsError) throw new Error('매치 참가자를 불러오지 못했습니다.');
    matchParticipants.push(
      (participantRows ?? []).map((row) => ({
        memberId: row.member_id as string | null,
        kills: row.kills as number,
        teamRank: row.team_rank as number,
        teamId: row.team_id as number,
      })),
    );
  }

  // "02 팀 구성 테이블"대로 안 하고 즉석에서 스쿼드를 짠 채로 내전을 치를 수도
  // 있다 — team_number 로는 실제로 누가 누구랑 뛰었는지 알 수 없으므로, 매치에
  // 실제 참가 기록이 있으면 계획(team_number) 대신 실제 PUBG team_id 로 되짚은
  // 스쿼드를 쓴다. 계획대로 뛰었다면 결과가 같으므로 이쪽이 항상 더 정확하다.
  const squadsForMatches: MatchParticipantForSquads[][] = matchParticipants.map((participants) =>
    participants.map((p) => ({ memberId: p.memberId, teamId: p.teamId })),
  );
  const squadByMemberId = deriveSquadsFromMatches(squadsForMatches);
  const squadNumbers = [...new Set(squadByMemberId.values())].sort((a, b) => a - b);
  const squadMembers: RosterMemberForScoring[] = [...squadByMemberId.entries()].map(
    ([memberId, teamNumber]) => ({ memberId, teamNumber }),
  );

  const { data: memberRows, error: memberFetchError } = await supabase
    .from('members')
    .select('id, discord_nickname, tier')
    .in('id', [...squadByMemberId.keys()]);
  if (memberFetchError) throw new Error('클랜원 명단을 불러오지 못했습니다.');
  const nicknameByMemberId = new Map(
    (memberRows ?? []).map((row) => [row.id as string, row.discord_nickname as string]),
  );
  const tierByMemberId = new Map(
    (memberRows ?? []).map((row) => [row.id as string, row.tier as number]),
  );

  // 02 표(1~4티어 칼럼)와 같은 순서로 보이도록, 팀 안에서도 티어가 낮은
  // (숫자가 작은 = 더 잘하는) 사람이 앞에 오게 정렬한다.
  const memberIdsBySquad = new Map<number, string[]>();
  for (const [memberId, squadNumber] of squadByMemberId) {
    const list = memberIdsBySquad.get(squadNumber) ?? [];
    list.push(memberId);
    memberIdsBySquad.set(squadNumber, list);
  }
  for (const [squadNumber, memberIds] of memberIdsBySquad) {
    memberIdsBySquad.set(
      squadNumber,
      [...memberIds].sort((a, b) => (tierByMemberId.get(a) ?? 0) - (tierByMemberId.get(b) ?? 0)),
    );
  }

  const roundsResults = matchParticipants.map((participants) => {
    const roundParticipants: RoundParticipant[] = participants.map((p) => ({
      memberId: p.memberId,
      kills: p.kills,
      teamRank: p.teamRank,
    }));
    return computeTeamRoundResults(roundParticipants, squadMembers, squadNumbers);
  });

  return {
    scrimDate,
    roundCount: roundsResults.length,
    teams: computeRoundSheet(roundsResults, squadNumbers).map((row) => {
      const memberIds = memberIdsBySquad.get(row.teamNumber) ?? [];
      return {
        ...row,
        memberIds,
        players: memberIds.map((id) => nicknameByMemberId.get(id) ?? '(닉네임 정보 없음)'),
      };
    }),
  };
}
