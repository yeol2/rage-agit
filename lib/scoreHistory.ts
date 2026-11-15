// 내전마다 그 사람의 종합점수가 얼마였는지 — 점수 변동 그래프의 재료.
//
// 리더보드 공식을 그대로 과거에 다시 돌린다(2026-11-14 결정, 방법 A). 내전 날짜마다
// "그날 밤까지의 경기만" 남겨서 member_alltime_stats / member_recent_ranking_stats
// 와 같은 평균을 내고, 리더보드와 같은 자격(eligibleForRanking)·같은 밴드 비교
// (rageScores)로 점수를 매긴다.
//
// 점수는 밴드 안 상대평가라 내가 쉬어도 남이 뛰면 바뀐다. 처음엔 쉰 날을 지난 점수로
// 일자로 이었는데, 그러면 리더보드 숫자와 어긋났다(2026-11-15 Ez_Code: 그래프 52.8 /
// 리더보드 48.5). 그래서 **자격이 있는 날은 뛰었든 안 뛰었든 그날의 실제 점수**를
// 남기고(played 로 구분), 마지막 점은 화면이 쓰는 종합점수로 덮는다(ScoreTrend) —
// 리더보드는 '지금' 날짜로 최근 N개월 자격을 따져서 내전이 없어도 조금씩 움직인다.
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
/** 내전 하루의 점수. 두 창 모두 리더보드와 같은 계산이다. played 가 false 면 그날 안 뛰었다. */
export interface ScorePoint {
  date: string;
  alltime: number;
  recent16: number;
  played: boolean;
}

export interface ScoreHistory {
  /** 점수에 센 내전 날짜(KST), 오래된 순. 저티어 내전은 점수에 안 들어가 여기 없다. */
  dates: string[];
  /** 클랜원별로 자격이 있던 날의 점수(뛰지 않은 날 포함, 내전 날짜순). */
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

    // 자격이 있는 사람은 그날 안 뛰었어도 점수를 남긴다 — 남이 뛰어서 바뀐 몫까지가 실제 점수다.
    for (const [id, a] of alltime) {
      const r = recent16.get(id);
      if (r === undefined) continue;
      (byMember[id] ??= []).push({ date, alltime: a, recent16: r, played: playedToday.has(id) });
    }
  }

  return { dates, byMember };
}

/** 그래프 한 칸 — 점수 이력 한 칸과 같은 모양이다. */
export type SeriesPoint = ScorePoint;
