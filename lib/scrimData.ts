import { getSupabase } from './supabaseBrowser';

export interface ScrimSessionSummary {
  id: string;
  scrimDate: string;
  title: string;
  sessionNumber: number | null;
  replayUrl: string | null;
  matchCount: number;
  participantCount: number;
}

export interface ScrimMatch {
  pubgMatchId: string;
  playedAt: string;
  mapName: string | null;
  participantCount: number;
}

export interface ScrimParticipant {
  pubgIgn: string;
  discordNickname: string | null;
  teamId: number;
  teamRank: number;
  kills: number;
  assists: number;
  damageDealt: number;
  dbnos: number;
  headshotKills: number;
  timeSurvived: number | null;
  distance: number | null;
}

export async function fetchScrimSessions(limit = 10): Promise<ScrimSessionSummary[]> {
  const { data, error } = await getSupabase()
    .from('scrim_session_summary')
    .select('id, scrim_date, title, session_number, replay_url, match_count, participant_count')
    .order('scrim_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`내전 목록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    scrimDate: row.scrim_date,
    title: row.title,
    sessionNumber: row.session_number,
    replayUrl: row.replay_url,
    matchCount: row.match_count,
    participantCount: row.participant_count,
  }));
}

export async function fetchSessionMatches(sessionId: string): Promise<ScrimMatch[]> {
  const { data, error } = await getSupabase()
    .from('matches')
    .select('pubg_match_id, played_at, map_name, participant_count')
    .eq('scrim_session_id', sessionId)
    .order('played_at');
  if (error) throw new Error(`경기 목록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    pubgMatchId: row.pubg_match_id,
    playedAt: row.played_at,
    mapName: row.map_name,
    participantCount: row.participant_count,
  }));
}

// 조인한 members 는 Supabase 타입 추론이 확정하지 못해 그대로 두면 빌드가 막힌다.
// 우리가 무엇을 고르는지 알고 있으므로 모양을 명시한다.
interface ParticipantRow {
  pubg_ign: string;
  team_id: number;
  team_rank: number;
  kills: number;
  assists: number;
  damage_dealt: number;
  dbnos: number;
  headshot_kills: number;
  time_survived: number | null;
  walk_distance: number | null;
  ride_distance: number | null;
  members: { discord_nickname: string } | { discord_nickname: string }[] | null;
}

export async function fetchMatchParticipants(pubgMatchId: string): Promise<ScrimParticipant[]> {
  const { data, error } = await getSupabase()
    .from('match_participants')
    .select(
      'pubg_ign, team_id, team_rank, kills, assists, damage_dealt, dbnos, headshot_kills, ' +
        'time_survived, walk_distance, ride_distance, members(discord_nickname)',
    )
    .eq('pubg_match_id', pubgMatchId)
    .returns<ParticipantRow[]>();
  if (error) throw new Error(`참가자를 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => {
    // members 는 조인 결과라 객체이거나 배열일 수 있다.
    const member = Array.isArray(row.members) ? row.members[0] : row.members;
    const walk = row.walk_distance;
    const ride = row.ride_distance;
    return {
      pubgIgn: row.pubg_ign,
      discordNickname: member?.discord_nickname ?? null,
      teamId: row.team_id,
      teamRank: row.team_rank,
      kills: row.kills,
      assists: row.assists,
      damageDealt: row.damage_dealt,
      dbnos: row.dbnos,
      headshotKills: row.headshot_kills,
      timeSurvived: row.time_survived,
      distance: walk === null && ride === null ? null : Number(walk ?? 0) + Number(ride ?? 0),
    };
  });
}

// dak.gg 처럼 팀 순위로 묶어 보여주되, 팀 안에서는 잘한 사람이 위로 온다.
export function sortByTeamRank(participants: ScrimParticipant[]): ScrimParticipant[] {
  return [...participants].sort(
    (a, b) => a.teamRank - b.teamRank || b.kills - a.kills || b.damageDealt - a.damageDealt,
  );
}

export function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return '-';
  return `${(meters / 1000).toFixed(2)}km`;
}

export function formatSurvival(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
