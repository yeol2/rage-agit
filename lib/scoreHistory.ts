// 내전마다 그 사람의 종합점수가 얼마였는지 — 점수 변동 그래프의 재료.
//
// 리더보드 공식을 그대로 과거에 다시 돌린다(2026-11-14 결정, 방법 A). 내전 날짜마다
// "그날 밤까지의 경기만" 남겨서 member_alltime_stats / member_recent_ranking_stats
// 와 같은 평균을 내고, 리더보드와 같은 자격(eligibleForRanking)·같은 밴드 비교
// (rageScores)로 점수를 매긴다. 그래서 마지막 점은 리더보드 숫자와 같다.
//
// 점수는 밴드 안 상대평가라 내가 쉬어도 남이 뛰면 바뀐다. 그래프는 그 흔들림을
// 안 보여주기로 했다 — 내가 뛴 날의 점수만 찍고, 쉰 날은 지난 점수를 그대로
// 잇는다(carrySeries). 쉬는 동안 남들 때문에 바뀐 몫은 다음에 뛴 날 변동에 섞인다.
//
// 이 파일 앞부분은 순수 계산이라 Supabase 없이 테스트한다.

import { placementPoints } from '@/lib/placementPoints.mjs';
import {
  RAGE_SCORE_STEEPNESS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  rageScores,
  type RankingStatsRow,
} from './rankingStats';

/** member_ranking_games 한 줄 — 점수에 세는 경기 하나. */
export interface RankedGame {
  memberId: string;
  kills: number;
  teamRank: number;
  playedAt: string;
}

export interface ScoredMember {
  id: string;
  tier: number;
}

/** 그 사람이 뛴 내전 하루의 점수. 두 창 모두 리더보드와 같은 값이다. */
export interface ScorePoint {
  date: string;
  alltime: number;
  recent16: number;
}

export interface ScoreHistory {
  /** 점수에 센 내전 날짜(KST), 오래된 순. 저티어 내전은 점수에 안 들어가 여기 없다. */
  dates: string[];
  /** 클랜원별로 자기가 뛰었고 자격이 있던 날의 점수만. */
  byMember: Record<string, ScorePoint[]>;
}

// member_recent_ranking_stats 의 창 — 최근 16경기(내전 4회).
const RECENT_GAMES = 16;
const KST_OFFSET_MS = 9 * 3600 * 1000;

export function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 그 KST 날짜가 끝나는 순간(다음 날 0시 KST). 이보다 이른 경기가 "그날까지"다. */
function kstDayEnd(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - KST_OFFSET_MS);
}

interface GameStat {
  kills: number;
  pp: number;
  rank: number;
}

function average(games: GameStat[]) {
  const n = games.length;
  return {
    avgKills: games.reduce((s, g) => s + g.kills, 0) / n,
    avgPlacementPoints: games.reduce((s, g) => s + g.pp, 0) / n,
    avgRank: games.reduce((s, g) => s + g.rank, 0) / n,
  };
}

export function computeScoreHistory(games: RankedGame[], members: ScoredMember[]): ScoreHistory {
  // 리더보드는 활동 중인 클랜원만 센다(fetchRankingStats 가 is_active 명단으로 거른다).
  const tierById = new Map(members.map((m) => [m.id, m.tier]));
  const sorted = games
    .filter((g) => tierById.has(g.memberId))
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const dates = [...new Set(sorted.map((g) => kstDate(g.playedAt)))].sort();

  const played = new Map<string, GameStat[]>(); // 경기 순서대로
  const lastPlayed = new Map<string, string>();
  const byMember: Record<string, ScorePoint[]> = {};
  let cursor = 0;

  for (const date of dates) {
    const end = kstDayEnd(date);
    const playedToday = new Set<string>();
    while (cursor < sorted.length && new Date(sorted[cursor].playedAt) < end) {
      const g = sorted[cursor++];
      if (!played.has(g.memberId)) played.set(g.memberId, []);
      played.get(g.memberId)!.push({ kills: g.kills, pp: placementPoints(g.teamRank), rank: g.teamRank });
      lastPlayed.set(g.memberId, g.playedAt);
      playedToday.add(g.memberId);
    }

    const base = (id: string, list: GameStat[]) => ({
      memberId: id,
      discordNickname: '',
      tier: tierById.get(id)!,
      totalGameCount: list.length,
      lastPlayedAt: lastPlayed.get(id)!,
      winCount: 0,
      crabKingCount: 0,
    });
    const alltimeRows: RankingStatsRow[] = [];
    const recentRows: RankingStatsRow[] = [];
    for (const [id, list] of played) {
      alltimeRows.push({ ...base(id, list), windowGameCount: list.length, ...average(list) });
      const recent = list.slice(-RECENT_GAMES);
      recentRows.push({ ...base(id, list), windowGameCount: recent.length, ...average(recent) });
    }

    // 자격은 "그날 밤" 기준이다 — 최근 N개월 참가 판정이 그 시점에서 거꾸로 센다.
    const alltime = new Map(
      rageScores(eligibleForRanking(alltimeRows, end), TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS).map(
        (r) => [r.memberId, r.score],
      ),
    );
    const recent16 = new Map(
      rageScores(eligibleForRanking(recentRows, end), TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS).map(
        (r) => [r.memberId, r.score],
      ),
    );

    for (const id of playedToday) {
      const a = alltime.get(id);
      const r = recent16.get(id);
      if (a === undefined || r === undefined) continue; // 아직 자격 미달
      (byMember[id] ??= []).push({ date, alltime: a, recent16: r });
    }
  }

  return { dates, byMember };
}

/** 그래프 한 칸. played 가 false 면 그날 안 뛰어서 지난 점수를 이어 그린 칸이다. */
export interface SeriesPoint {
  date: string;
  alltime: number;
  recent16: number;
  played: boolean;
}

/**
 * 내전 날짜 전체에 걸쳐 점수를 잇는다. 첫 점수가 생기기 전 날짜는 빼고, 그 뒤로
 * 안 뛴 날은 직전 점수를 그대로 둔다 — 그래프에서 일자로 이어진다.
 */
export function carrySeries(dates: string[], points: ScorePoint[]): SeriesPoint[] {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const out: SeriesPoint[] = [];
  let last: ScorePoint | null = null;
  for (const date of dates) {
    const p = byDate.get(date);
    if (p) last = p;
    if (!last) continue;
    out.push({ date, alltime: last.alltime, recent16: last.recent16, played: Boolean(p) });
  }
  return out;
}
