import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeRoundSheet,
  computeTeamRoundResults,
  squadsFromTeamIds,
  type MatchParticipantForSquads,
  type RoundParticipant,
  type PlayerForScoring,
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
  /**
   * 세션 도중 team_id 가 바뀐 클랜원의 닉네임. 비어 있는 게 정상이다.
   * 값이 있으면 팀 번호를 team_id 로 삼는 전제가 깨진 것이라 화면이 경고한다.
   */
  unstableTeamPlayers: string[];
}

/** 가장 최근에 매치가 잡힌 내전 날짜. 아직 한 번도 없으면 null. */
export async function latestScrimDate(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrim_sessions')
    .select('scrim_date')
    .order('scrim_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('내전 세션을 조회하지 못했습니다.');
  return (data?.scrim_date as string | undefined) ?? null;
}

/**
 * 01 내전 시트 한 장을 만든다. 날짜 하나로만 만든다.
 *
 * 로스터(01 업로드 → 02 팀 구성)는 **일부러 안 본다.** 시트는 "실제로 이렇게
 * 뛰었다"를 그리는 화면이고, 로스터는 "이렇게 나눌 계획이었다"라서 둘은 얼마든지
 * 다를 수 있다 — 2026-08-27 은 계획 1팀 4명이 실제로는 1·5·9·13팀으로 흩어져
 * 뛰었다. 예전에는 로스터의 업로드 시각에서 날짜를 뽑아 세션을 찾았는데, 그러면
 * "초기화"로 로스터를 지우는 순간 멀쩡히 남아 있는 지난 내전 시트를 못 보게 됐다.
 *
 * 시트를 보여줄 때(GET)와 우승을 확정할 때(POST)가 **같은 값을 봐야 하므로**
 * 계산은 여기 한 곳에만 둔다. 확정 쪽이 클라이언트가 보낸 우승팀을 그대로
 * 믿지 않고 서버에서 다시 구하는 것도 이 때문이다.
 */
export async function buildRoundSheet(
  supabase: SupabaseClient,
  scrimDate: string,
): Promise<RoundSheetData> {
  const { data: session, error: sessionError } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('scrim_date', scrimDate)
    .maybeSingle();
  if (sessionError) throw new Error('내전 세션을 조회하지 못했습니다.');

  // 아직 그날 경기가 하나도 안 잡혔으면 빈 시트다. 팀도 선수도 매치에서만
  // 나오므로, 계획을 대신 채워 넣지 않는다 — 그러면 첫 라운드가 들어오는
  // 순간 화면이 통째로 뒤바뀌어 "폴링했더니 팀이 틀어졌다"로 보인다.
  const emptySheet = (): RoundSheetData => ({
    scrimDate: session ? scrimDate : null,
    roundCount: 0,
    teams: [],
    unstableTeamPlayers: [],
  });

  if (!session) return emptySheet();

  // 재경기는 라운드로 세지 않는다. 이걸 안 걸러내면 2026-08-16 처럼 재경기가
  // 4번째 자리를 차지해서, limit(4) 에 진짜 마지막 라운드가 잘려나간다.
  //
  // matches 가 아니라 countable_matches 를 읽는다(0037) — "세는 매치"의 판정이
  // 거기 한 곳에 있다. 예전에는 여기서 제외 표시만 봤기 때문에, 사람이 표시를
  // 달기 전까지 시트만 재경기를 라운드로 세는 상태가 있었다.
  const { data: matchRows, error: matchesError } = await supabase
    .from('countable_matches')
    .select('pubg_match_id')
    .eq('scrim_session_id', session.id)
    .order('played_at', { ascending: true })
    .limit(4);
  if (matchesError) throw new Error('매치 목록을 불러오지 못했습니다.');
  if (!matchRows || matchRows.length === 0) return emptySheet();

  // 사람 하나를 가리키는 열쇠. 등록된 클랜원이면 member_id 를 그대로 쓰고,
  // 아직 안 묶인 참가자는 PUBG 계정으로 만든 키를 쓴다 — 그래야 라운드가 바뀌어도
  // 같은 사람으로 이어지고, 나중에 계정을 묶으면 member_id 쪽으로 자연히 옮겨간다.
  const playerKeyOf = (row: { member_id: unknown; pubg_account_id: unknown; pubg_ign: unknown }) =>
    (row.member_id as string | null) ??
    `pubg:${(row.pubg_account_id as string | null) ?? (row.pubg_ign as string)}`;

  const matchParticipants: {
    playerKey: string;
    memberId: string | null;
    ign: string;
    kills: number;
    teamRank: number;
    teamId: number;
  }[][] = [];
  for (const match of matchRows) {
    // 정렬을 명시하지 않으면 Postgres 가 행을 어떤 순서로 돌려줄지 보장이 없다
    // (0030 에서 scrim_roster_entries 에 같은 이유로 order 를 붙였다). 실제로
    // 이 표는 계획이 순차 스캔이냐 인덱스 스캔이냐에 따라 순서가 달라진다.
    // 팀 번호는 이제 team_id 라 순서와 무관하지만, 팀 안에서 이름을 늘어놓는
    // 순서(같은 티어끼리)는 여전히 이 배열 순서를 탄다.
    const { data: participantRows, error: participantsError } = await supabase
      .from('match_participants')
      .select('member_id, pubg_ign, pubg_account_id, kills, team_rank, team_id')
      .eq('pubg_match_id', match.pubg_match_id)
      .order('id', { ascending: true });
    if (participantsError) throw new Error('매치 참가자를 불러오지 못했습니다.');
    matchParticipants.push(
      (participantRows ?? []).map((row) => ({
        playerKey: playerKeyOf(row),
        memberId: row.member_id as string | null,
        ign: row.pubg_ign as string,
        kills: row.kills as number,
        teamRank: row.team_rank as number,
        teamId: row.team_id as number,
      })),
    );
  }

  // "02 팀 구성 테이블"대로 안 하고 즉석에서 스쿼드를 짠 채로 내전을 치를 수도
  // 있다 — 실제로 최근 세션은 계획한 team_number 와 실제로 뛴 팀이 거의 다
  // 어긋났다. 그래서 계획이 아니라 PUBG 가 매긴 team_id 를 팀 번호로 쓴다.
  // 계획대로 뛰었다면 결과가 같으므로 이쪽이 항상 더 정확하다.
  const squadsForMatches: MatchParticipantForSquads[][] = matchParticipants.map((participants) =>
    participants.map((p) => ({ playerKey: p.playerKey, teamId: p.teamId })),
  );
  const { squadByPlayerKey, unstablePlayerKeys } = squadsFromTeamIds(squadsForMatches);
  const squadNumbers = [...new Set(squadByPlayerKey.values())].sort((a, b) => a - b);
  const squadPlayers: PlayerForScoring[] = [...squadByPlayerKey.entries()].map(
    ([playerKey, teamNumber]) => ({ playerKey, teamNumber }),
  );

  // 아직 안 묶인 참가자는 PUBG 닉네임으로 부른다 — members 에 없으니 그것이
  // 우리가 아는 전부다. 라운드마다 같은 사람이 여러 번 나오므로 한 번만 담는다.
  const ignByPlayerKey = new Map<string, string>();
  for (const participants of matchParticipants) {
    for (const p of participants) {
      if (p.memberId === null) ignByPlayerKey.set(p.playerKey, p.ign);
    }
  }

  const { data: memberRows, error: memberFetchError } = await supabase
    .from('members')
    .select('id, discord_nickname, tier')
    .in('id', [...squadByPlayerKey.keys()].filter((key) => !key.startsWith('pubg:')));
  if (memberFetchError) throw new Error('클랜원 명단을 불러오지 못했습니다.');
  const nicknameByMemberId = new Map(
    (memberRows ?? []).map((row) => [row.id as string, row.discord_nickname as string]),
  );
  const tierByMemberId = new Map(
    (memberRows ?? []).map((row) => [row.id as string, row.tier as number]),
  );

  // 02 표(1~4티어 칼럼)와 같은 순서로 보이도록, 팀 안에서도 티어가 낮은
  // (숫자가 작은 = 더 잘하는) 사람이 앞에 오게 정렬한다.
  // 티어를 모르는 사람(미등록)은 맨 뒤로 보낸다 — 0 으로 두면 1티어보다 앞에 선다.
  const UNKNOWN_TIER = Number.POSITIVE_INFINITY;
  const playerKeysBySquad = new Map<number, string[]>();
  for (const [playerKey, squadNumber] of squadByPlayerKey) {
    const list = playerKeysBySquad.get(squadNumber) ?? [];
    list.push(playerKey);
    playerKeysBySquad.set(squadNumber, list);
  }
  for (const [squadNumber, keys] of playerKeysBySquad) {
    playerKeysBySquad.set(
      squadNumber,
      [...keys].sort(
        (a, b) => (tierByMemberId.get(a) ?? UNKNOWN_TIER) - (tierByMemberId.get(b) ?? UNKNOWN_TIER),
      ),
    );
  }

  const roundsResults = matchParticipants.map((participants) => {
    const roundParticipants: RoundParticipant[] = participants.map((p) => ({
      playerKey: p.playerKey,
      kills: p.kills,
      teamRank: p.teamRank,
    }));
    return computeTeamRoundResults(roundParticipants, squadPlayers, squadNumbers);
  });

  const displayName = (key: string) =>
    nicknameByMemberId.get(key) ?? ignByPlayerKey.get(key) ?? '(닉네임 정보 없음)';

  return {
    scrimDate,
    roundCount: roundsResults.length,
    unstableTeamPlayers: unstablePlayerKeys.map(displayName),
    teams: computeRoundSheet(roundsResults, squadNumbers).map((row) => {
      const playerKeys = playerKeysBySquad.get(row.teamNumber) ?? [];
      return {
        ...row,
        // memberIds 는 우승 확정이 session_standings 에 넣는 값이라 **등록된
        // 클랜원만** 담는다. 미등록 참가자는 넣을 member_id 가 없다 — 이름은
        // 시트에 보이지만 등수 기록에는 안 남는다.
        memberIds: playerKeys.filter((key) => !key.startsWith('pubg:')),
        players: playerKeys.map(displayName),
      };
    }),
  };
}
