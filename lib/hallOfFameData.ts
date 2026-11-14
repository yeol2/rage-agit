import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { mapLabel } from '@/lib/mapNames';
import { TIER_GROUPS } from '@/lib/dashboardData';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';
import {
  dayTotals,
  kstDate,
  rankByTierGroup,
  rankTop,
  singleGameCandidates,
  teamMatchScores,
  winningScores,
  type PlayerGameStat,
  type RecordBoard,
  type SingleGameRow,
  type TeamGameRow,
  type WinnerRow,
} from '@/lib/hallOfFame';

// 명예의 전당 데이터. match_participants·session_standings 는 anon 이 못 읽는 표라
// 서버 전용 키로 읽는다 — 이 파일은 서버 컴포넌트에서만 쓴다.

// 딜량은 이날부터(PUBG API 로 수집한 첫 내전). 그 전 dak.gg 백필은 뺀다.
export const DAMAGE_SINCE = '2026-07-26';

// 스크린샷 시절 라운드별 맵. scrim_round_maps 에 따로 적힌 날만 다르다
// (member_map_stats 뷰와 같은 규칙 — 0042).
const DEFAULT_ROUND_MAPS: Record<number, string> = {
  1: 'Neon_Main',
  2: 'Baltic_Main',
  3: 'Desert_Main',
  4: 'Tiger_Main',
};

const PAGE = 1000;

async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`명예의 전당 데이터를 불러오지 못했습니다: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function displayName(nickname: string): string {
  return stripTrailingKoreanTag(cleanDisplayName(nickname));
}

async function loadMembers(supabase: SupabaseClient): Promise<Map<string, { name: string; tier: number }>> {
  const rows = await selectAll<{ id: string; discord_nickname: string; tier: number }>((from, to) =>
    supabase.from('members').select('id, discord_nickname, tier').order('id').range(from, to),
  );
  return new Map(rows.map((r) => [r.id, { name: displayName(r.discord_nickname), tier: r.tier }]));
}

export async function fetchHallOfFame(): Promise<RecordBoard[]> {
  const supabase = getSupabaseServer();
  const members = await loadMembers(supabase);
  const nameOf = (memberId: string | null, ign: string) => (memberId ? members.get(memberId)?.name ?? ign : ign);
  // 티어는 지금 티어다. 안 묶인 계정(게스트·탈퇴자)은 티어가 없다.
  const tierOf = (memberId: string | null) => (memberId ? members.get(memberId)?.tier ?? null : null);

  const [rankedGames, apiMatches, screenshotRows, roundMaps, winners] = await Promise.all([
    // 점수에 세는 경기(확정 + 저티어 아님) — 스크린샷·dak.gg·PUBG API 다 들어 있다.
    selectAll<{ member_id: string; kills: number; played_at: string }>((from, to) =>
      supabase
        .from('member_ranking_games')
        .select('member_id, kills, played_at')
        .order('played_at')
        .order('member_id')
        .range(from, to),
    ),
    // PUBG API 와 dak.gg 경기 둘 다 — 단일 매치 최다 킬은 내전 최다 킬과 같은 범위
    // (dak.gg 포함)를 보고, 딜량·팀 점수는 아래에서 PUBG API 것만 고른다.
    selectAll<{ pubg_match_id: string; played_at: string; map_name: string | null; source: string }>(
      (from, to) =>
        supabase
          .from('ranked_matches')
          .select('pubg_match_id, played_at, map_name, source')
          .order('played_at')
          .order('pubg_match_id')
          .range(from, to),
    ),
    selectAll<{
      scrim_date: string;
      round_no: number;
      team_no: number;
      team_rank: number;
      pubg_ign: string;
      member_id: string | null;
      kills: number;
    }>((from, to) =>
      supabase
        .from('scrim_screenshot_results')
        .select('scrim_date, round_no, team_no, team_rank, pubg_ign, member_id, kills')
        .order('id')
        .range(from, to),
    ),
    supabase.from('scrim_round_maps').select('scrim_date, round_no, map_name'),
    selectAll<{
      scrim_date: string;
      team_no: number | null;
      total_score: number;
      place_points: number;
      kills: number;
      member_id: string;
    }>((from, to) =>
      supabase
        .from('session_standings')
        .select('scrim_date, team_no, total_score, place_points, kills, member_id')
        .eq('standing', 1)
        .eq('low_tier', false)
        .order('scrim_date')
        .order('member_id')
        .range(from, to),
    ),
  ]);
  if (roundMaps.error) throw new Error(`라운드 맵을 불러오지 못했습니다: ${roundMaps.error.message}`);

  const matchById = new Map(apiMatches.map((m) => [m.pubg_match_id, m]));
  const matchIds = [...matchById.keys()];
  const participants =
    matchIds.length === 0
      ? []
      : await selectAll<{
          pubg_match_id: string;
          team_id: number;
          team_rank: number;
          kills: number;
          damage_dealt: number;
          member_id: string | null;
          pubg_ign: string;
        }>((from, to) =>
          supabase
            .from('match_participants')
            .select('pubg_match_id, team_id, team_rank, kills, damage_dealt, member_id, pubg_ign')
            .in('pubg_match_id', matchIds)
            .order('id')
            .range(from, to),
        );

  // --- 내전 최다 킬: 그날 4경기 킬 합계(클랜원) ---
  const killStats: PlayerGameStat[] = rankedGames.map((g) => ({
    key: g.member_id,
    name: nameOf(g.member_id, '?'),
    tier: tierOf(g.member_id),
    date: kstDate(g.played_at),
    value: g.kills,
  }));

  // --- 내전 최다 딜: 그날 4경기 딜량 합계(클랜원, PUBG API 경기) ---
  const damageStats: PlayerGameStat[] = participants.flatMap((p) => {
    const match = matchById.get(p.pubg_match_id)!;
    const date = kstDate(match.played_at);
    if (!p.member_id || match.source !== 'pubg_api' || date < DAMAGE_SINCE) return [];
    return [
      { key: p.member_id, name: nameOf(p.member_id, p.pubg_ign), tier: tierOf(p.member_id), date, value: Number(p.damage_dealt) },
    ];
  });

  // --- 매치 당 최다 점수: 한 경기 한 팀(PUBG API + 스크린샷, dak.gg 는 팀 번호가 틀려 뺀다) ---
  const roundMapOverride = new Map(
    (roundMaps.data ?? []).map((r) => [`${r.scrim_date}#${r.round_no}`, r.map_name as string]),
  );
  const teamRows: TeamGameRow[] = [
    ...participants.flatMap((p) => {
      const match = matchById.get(p.pubg_match_id)!;
      if (match.source !== 'pubg_api') return [];
      return {
        teamKey: `${p.pubg_match_id}#${p.team_id}`,
        date: kstDate(match.played_at),
        map: mapLabel(match.map_name),
        teamRank: p.team_rank,
        name: nameOf(p.member_id, p.pubg_ign),
        tier: tierOf(p.member_id),
        kills: p.kills,
      };
    }),
    ...screenshotRows.map((r) => ({
      teamKey: `${r.scrim_date}#${r.round_no}#${r.team_no}`,
      date: r.scrim_date,
      map: mapLabel(roundMapOverride.get(`${r.scrim_date}#${r.round_no}`) ?? DEFAULT_ROUND_MAPS[r.round_no] ?? null),
      teamRank: r.team_rank,
      name: nameOf(r.member_id, r.pubg_ign),
      tier: tierOf(r.member_id),
      kills: r.kills,
    })),
  ];

  // --- 단일 매치 최다 킬: 한 경기 개인 킬(클랜원, 티어 무관) ---
  // 내전 최다 킬과 같은 범위 — PUBG API·dak.gg 경기(맵은 경기 기록) + 스크린샷(맵은 라운드 맵).
  const roundMapOf = (date: string, roundNo: number) =>
    mapLabel(roundMapOverride.get(`${date}#${roundNo}`) ?? DEFAULT_ROUND_MAPS[roundNo] ?? null);
  const matchKillRows: SingleGameRow[] = [
    ...participants.flatMap((p) => {
      if (!p.member_id) return [];
      const match = matchById.get(p.pubg_match_id)!;
      return [
        {
          name: nameOf(p.member_id, p.pubg_ign),
          tier: tierOf(p.member_id),
          date: kstDate(match.played_at),
          map: mapLabel(match.map_name),
          teamRank: p.team_rank,
          value: p.kills,
        },
      ];
    }),
    ...screenshotRows.flatMap((r) =>
      r.member_id
        ? [
            {
              name: nameOf(r.member_id, r.pubg_ign),
              tier: tierOf(r.member_id),
              date: r.scrim_date,
              map: roundMapOf(r.scrim_date, r.round_no),
              teamRank: r.team_rank,
              value: r.kills,
            },
          ]
        : [],
    ),
  ];

  // --- 최고/최저 점수 우승: 그날 종합 1등 팀(일반 내전) ---
  const winnerRows: WinnerRow[] = winners.map((w) => ({
    date: w.scrim_date,
    teamNo: w.team_no,
    totalScore: w.total_score,
    placePoints: w.place_points,
    kills: w.kills,
    name: nameOf(w.member_id, '?'),
    tier: tierOf(w.member_id),
  }));
  const wins = winningScores(winnerRows);

  const dayKillTotals = dayTotals(killStats);
  const firstDate = (dates: string[]) => dates.reduce((a, b) => (a < b ? a : b), dates[0] ?? '');

  return [
    {
      id: 'dayKills',
      kind: 'player',
      title: '내전 최다 킬',
      description: '하루 내전(4경기) 동안 혼자 올린 킬 합계',
      unit: '킬',
      since: firstDate(killStats.map((s) => s.date)),
      entries: rankTop(dayKillTotals, 'desc'),
      // 티어 그룹별 탭(전체 · 0~1.5 · 2~2.5 · 3~3.5 · 4~5) — 리더보드와 같은 경계.
      groups: rankByTierGroup(dayKillTotals, 'desc', TIER_GROUPS),
    },
    {
      id: 'matchKills',
      kind: 'player',
      title: '단일 매치 최다 킬',
      description: '한 경기에서 혼자 올린 킬 — 티어 무관',
      unit: '킬',
      since: firstDate(matchKillRows.map((r) => r.date)),
      entries: rankTop(singleGameCandidates(matchKillRows), 'desc'),
    },
    {
      id: 'dayDamage',
      kind: 'player',
      title: '내전 최다 딜',
      description: '하루 내전(4경기) 동안 혼자 넣은 딜량 합계',
      unit: '딜',
      since: DAMAGE_SINCE,
      entries: rankTop(dayTotals(damageStats), 'desc'),
    },
    {
      id: 'matchTeamScore',
      kind: 'team',
      title: '매치 당 최다 점수',
      description: '한 경기에서 한 팀이 얻은 점수(순위점수 + 팀 킬)',
      unit: '점',
      since: firstDate(teamRows.map((r) => r.date)),
      entries: rankTop(teamMatchScores(teamRows), 'desc'),
    },
    {
      id: 'highestWin',
      kind: 'team',
      title: '최고 점수 우승',
      description: '그날 내전을 가장 높은 총점으로 우승한 팀',
      unit: '점',
      since: firstDate(wins.map((w) => w.date)),
      entries: rankTop(wins, 'desc'),
    },
    {
      id: 'lowestWin',
      kind: 'team',
      title: '최저 점수 우승',
      description: '그날 내전을 가장 낮은 총점으로 우승한 팀',
      unit: '점',
      since: firstDate(wins.map((w) => w.date)),
      entries: rankTop(wins, 'asc'),
    },
  ];
}
