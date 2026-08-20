import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  type RoundParticipant,
  type RosterMemberForScoring,
} from '@/lib/roundSheet';

const KST_OFFSET_MS = 9 * 3600 * 1000;

// supabase/functions/_shared/sessions.mjs 의 toKstDate() 와 같은 규칙이다 —
// 내전은 한국시간 저녁에 열리므로 UTC 날짜로 묶으면 사람이 부르는 날짜와
// 어긋난다. 그 파일은 Deno/Node 공용 모듈이라 여기서는 짧으니 그냥 옮겨 쓴다.
function todayKstDate(): string {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
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
    .select('discord_nickname, member_id, tier_slot, team_number')
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
  const rosterMembers: RosterMemberForScoring[] = (entryRows ?? [])
    .filter((row): row is typeof row & { member_id: string } => row.member_id !== null)
    .map((row) => ({ memberId: row.member_id as string, teamNumber: row.team_number as number }));

  const { data: session, error: sessionError } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('scrim_date', todayKstDate())
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

  const roundsResults = [];
  for (const match of matchRows ?? []) {
    const { data: participantRows, error: participantsError } = await supabase
      .from('match_participants')
      .select('member_id, kills, team_rank')
      .eq('pubg_match_id', match.pubg_match_id);
    if (participantsError) {
      return NextResponse.json({ error: '매치 참가자를 불러오지 못했습니다.' }, { status: 500 });
    }

    const participants: RoundParticipant[] = (participantRows ?? []).map((row) => ({
      memberId: row.member_id as string | null,
      kills: row.kills as number,
      teamRank: row.team_rank as number,
    }));
    roundsResults.push(computeTeamRoundResults(participants, rosterMembers, teamNumbers));
  }

  const rows = computeRoundSheet(roundsResults, teamNumbers);

  return NextResponse.json({
    roundCount: roundsResults.length,
    teams: rows.map((row) => ({ ...row, players: playersByTeam.get(row.teamNumber) ?? [] })),
  });
}
