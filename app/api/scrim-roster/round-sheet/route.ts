import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  deriveSquadsFromMatches,
  type MatchParticipantForSquads,
  type RoundParticipant,
  type RosterMemberForScoring,
} from '@/lib/roundSheet';

const KST_OFFSET_MS = 9 * 3600 * 1000;

// supabase/functions/_shared/sessions.mjs 의 toKstDate() 와 같은 규칙이다 —
// 내전은 한국시간 저녁에 열리므로 UTC 날짜로 묶으면 사람이 부르는 날짜와
// 어긋난다. 그 파일은 Deno/Node 공용 모듈이라 여기서는 짧으니 그냥 옮겨 쓴다.
function toKstDate(isoTimestamp: string): string {
  const kst = new Date(new Date(isoTimestamp).getTime() + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

export async function GET(request: Request) {
  const rosterId = new URL(request.url).searchParams.get('rosterId');
  if (!rosterId) {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: entryRows, error: entriesError } = await supabase
    .from('scrim_roster_entries')
    .select('discord_nickname, tier_slot, team_number')
    .eq('roster_id', rosterId)
    .not('team_number', 'is', null)
    .order('tier_slot', { ascending: true });
  if (entriesError) {
    return NextResponse.json({ error: '로스터를 불러오지 못했습니다.' }, { status: 500 });
  }

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
  if (rosterFetchError || !rosterRow) {
    return NextResponse.json({ error: '로스터를 불러오지 못했습니다.' }, { status: 500 });
  }

  const { data: session, error: sessionError } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('scrim_date', toKstDate(rosterRow.fetched_at as string))
    .maybeSingle();
  if (sessionError) {
    return NextResponse.json({ error: '내전 세션을 조회하지 못했습니다.' }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({
      roundCount: 0,
      teams: computeRoundSheet([], teamNumbers).map((row) => ({
        ...row,
        players: playersByTeam.get(row.teamNumber) ?? [],
      })),
    });
  }

  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('pubg_match_id')
    .eq('scrim_session_id', session.id)
    .order('played_at', { ascending: true })
    .limit(4);
  if (matchesError) {
    return NextResponse.json({ error: '매치 목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  if (!matchRows || matchRows.length === 0) {
    return NextResponse.json({
      roundCount: 0,
      teams: computeRoundSheet([], teamNumbers).map((row) => ({
        ...row,
        players: playersByTeam.get(row.teamNumber) ?? [],
      })),
    });
  }

  const matchParticipants: { memberId: string | null; kills: number; teamRank: number; teamId: number }[][] = [];
  for (const match of matchRows) {
    const { data: participantRows, error: participantsError } = await supabase
      .from('match_participants')
      .select('member_id, kills, team_rank, team_id')
      .eq('pubg_match_id', match.pubg_match_id);
    if (participantsError) {
      return NextResponse.json({ error: '매치 참가자를 불러오지 못했습니다.' }, { status: 500 });
    }
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
  if (memberFetchError) {
    return NextResponse.json({ error: '클랜원 명단을 불러오지 못했습니다.' }, { status: 500 });
  }
  const nicknameByMemberId = new Map(
    (memberRows ?? []).map((row) => [row.id as string, row.discord_nickname as string]),
  );
  const tierByMemberId = new Map((memberRows ?? []).map((row) => [row.id as string, row.tier as number]));

  // 02 표(1~4티어 칼럼)와 같은 순서로 보이도록, 팀 안에서도 티어가 낮은
  // (숫자가 작은 = 더 잘하는) 사람이 앞에 오게 정렬한다.
  const memberIdsBySquad = new Map<number, string[]>();
  for (const [memberId, squadNumber] of squadByMemberId) {
    const list = memberIdsBySquad.get(squadNumber) ?? [];
    list.push(memberId);
    memberIdsBySquad.set(squadNumber, list);
  }
  const playersBySquad = new Map<number, string[]>();
  for (const [squadNumber, memberIds] of memberIdsBySquad) {
    const sorted = [...memberIds].sort(
      (a, b) => (tierByMemberId.get(a) ?? 0) - (tierByMemberId.get(b) ?? 0),
    );
    playersBySquad.set(
      squadNumber,
      sorted.map((memberId) => nicknameByMemberId.get(memberId) ?? '(닉네임 정보 없음)'),
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

  const rows = computeRoundSheet(roundsResults, squadNumbers);

  return NextResponse.json({
    roundCount: roundsResults.length,
    teams: rows.map((row) => ({ ...row, players: playersBySquad.get(row.teamNumber) ?? [] })),
  });
}
