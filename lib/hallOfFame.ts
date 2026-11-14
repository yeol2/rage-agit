// 명예의 전당 — 기록 다섯 가지의 1~10위.
//
// 사용자가 정한 것(2026-11-14):
//   · 내전 최다 킬 / 최다 딜 — 한 경기가 아니라 **그날 내전(4경기) 합계**.
//   · 매치 당 최다 점수 — 한 경기에서 한 팀이 얻은 점수(순위점수 + 팀 킬).
//   · 최고 / 최저 점수 우승 — 그날 종합 1등 팀의 총점.
//   · 중복 허용 — 한 사람이 1·3·6등을 다 가질 수 있다.
//   · 기록마다 날짜와 맵("2026-11-11 에란겔"). 하루 단위 기록은 맵이 하나가 아니라 날짜만.
//   · 딜량은 2026-07-26 이후(PUBG API 경기)만 — 그 전 dak.gg 백필은 내전 기록 탭에서도
//     숨겨 둔 기간이다. 스크린샷 시절(2~5월)은 딜량 자체가 없다.
//   · 우승 기록은 일반 내전만. 다른 기록도 저티어 내전은 뺀다(뱃지 규칙과 같다).
//
// 이 파일 앞부분은 순수 계산이라 Supabase 없이 테스트한다.

import { placementPoints } from '@/lib/placementPoints.mjs';

/** 기록에 오른 사람. 티어는 지금 티어다(뱃지 규칙과 같다). 안 묶인 계정은 null. */
export interface RecordPlayer {
  name: string;
  tier: number | null;
}

export interface RecordEntry {
  /** 동률이면 같은 등수, 다음 등수는 건너뛴다(1, 1, 3). */
  rank: number;
  /** 개인 기록은 한 명, 팀 기록은 팀원 전원(고티어 → 저티어 순). */
  players: RecordPlayer[];
  value: number;
  date: string;
  /** 한 경기 기록에만 있다(하루 기록·우승 기록은 null). */
  map: string | null;
  /** 값 옆 작은 설명 — 예: '순위 10 + 킬 22', '4경기'. */
  detail: string | null;
}

export interface RecordBoard {
  id: 'dayKills' | 'dayDamage' | 'matchTeamScore' | 'highestWin' | 'lowestWin';
  /** 개인 기록은 이름 옆에 티어 뱃지를, 팀 기록은 이름만 늘어놓는다. */
  kind: 'player' | 'team';
  title: string;
  description: string;
  unit: string;
  /** 데이터가 이 날짜부터 있다 — 카드 아래에 작게 적는다. */
  since: string;
  entries: RecordEntry[];
}

type Candidate = Omit<RecordEntry, 'rank'>;

export const RECORD_LIMIT = 10;

/**
 * 값으로 줄 세워 1~limit 등까지 자른다. 동률은 같은 등수고 다음 등수를 건너뛴다.
 * limit 등에 동률이 걸리면 그 사람들도 다 넣는다 — 같은 기록인데 누구는 빠지면 이상하다.
 * 값이 같으면 먼저 세운 기록(날짜가 이른 것)이 위에 온다.
 */
export function rankTop(candidates: Candidate[], order: 'desc' | 'asc', limit = RECORD_LIMIT): RecordEntry[] {
  const sorted = [...candidates].sort((a, b) =>
    a.value === b.value ? a.date.localeCompare(b.date) : order === 'desc' ? b.value - a.value : a.value - b.value,
  );
  const out: RecordEntry[] = [];
  let prevRank = 0;
  for (const [i, c] of sorted.entries()) {
    const rank = i > 0 && c.value === sorted[i - 1].value ? prevRank : i + 1;
    if (rank > limit) break; // 정렬돼 있으니 이 뒤는 전부 limit 밖이다
    out.push({ ...c, rank });
    prevRank = rank;
  }
  return out;
}

const KST_OFFSET_MS = 9 * 3600 * 1000;
export function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 사람 한 명이 한 경기에서 낸 값. date 는 KST 날짜. */
export interface PlayerGameStat {
  name: string;
  tier: number | null;
  /** 같은 사람을 묶는 열쇠 — 클랜원은 member id, 안 묶인 계정은 PUBG 닉. */
  key: string;
  date: string;
  value: number;
}

/** 그날 내전 합계(사람 × 날짜). */
export function dayTotals(stats: PlayerGameStat[]): Candidate[] {
  const byKey = new Map<string, { name: string; tier: number | null; date: string; value: number; games: number }>();
  for (const s of stats) {
    const k = `${s.key}#${s.date}`;
    const cur = byKey.get(k) ?? { name: s.name, tier: s.tier, date: s.date, value: 0, games: 0 };
    cur.value += s.value;
    cur.games += 1;
    byKey.set(k, cur);
  }
  return [...byKey.values()].map((d) => ({
    players: [{ name: d.name, tier: d.tier }],
    value: Math.round(d.value),
    date: d.date,
    map: null,
    detail: `${d.games}경기`,
  }));
}

/** 한 경기의 한 팀 — 팀원 전원(안 묶인 계정 포함)의 킬을 합친다. */
export interface TeamGameRow {
  /** 경기 + 팀을 가르는 열쇠. */
  teamKey: string;
  date: string;
  map: string | null;
  teamRank: number;
  name: string;
  tier: number | null;
  kills: number;
}

/** 팀원은 고티어(숫자 작은 쪽) → 저티어 순. 티어 없는 안 묶인 계정은 맨 뒤. */
export function byTier(players: RecordPlayer[]): RecordPlayer[] {
  return [...players].sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));
}

export function teamMatchScores(rows: TeamGameRow[]): Candidate[] {
  const byTeam = new Map<string, { date: string; map: string | null; teamRank: number; kills: number; players: RecordPlayer[] }>();
  for (const r of rows) {
    const cur = byTeam.get(r.teamKey) ?? { date: r.date, map: r.map, teamRank: r.teamRank, kills: 0, players: [] };
    cur.kills += r.kills;
    cur.players.push({ name: r.name, tier: r.tier });
    byTeam.set(r.teamKey, cur);
  }
  return [...byTeam.values()].map((t) => {
    const place = placementPoints(t.teamRank);
    return {
      players: byTier(t.players),
      value: place + t.kills,
      date: t.date,
      map: t.map,
      detail: `${t.teamRank}등 · 순위 ${place} + 킬 ${t.kills}`,
    };
  });
}

/** 확정된 종합등수 한 줄(사람 단위). */
export interface WinnerRow {
  date: string;
  teamNo: number | null;
  totalScore: number;
  placePoints: number;
  kills: number;
  name: string;
  tier: number | null;
}

/** 그날 1등 팀 하나로 묶는다 — 팀원 넷이 같은 총점을 나눠 갖고 있다. */
export function winningScores(rows: WinnerRow[]): Candidate[] {
  const byDate = new Map<string, Candidate & { placePoints: number; kills: number }>();
  for (const r of rows) {
    const cur = byDate.get(r.date);
    if (cur) {
      cur.players.push({ name: r.name, tier: r.tier });
      continue;
    }
    byDate.set(r.date, {
      players: [{ name: r.name, tier: r.tier }],
      value: r.totalScore,
      date: r.date,
      map: null,
      detail: `순위 ${r.placePoints} + 킬 ${r.kills}`,
      placePoints: r.placePoints,
      kills: r.kills,
    });
  }
  return [...byDate.values()].map(({ placePoints: _p, kills: _k, ...c }) => ({ ...c, players: byTier(c.players) }));
}
