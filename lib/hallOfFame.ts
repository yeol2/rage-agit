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
  /** 1 ~ 10. 기록이 같으면 먼저 달성한 쪽이 위 등수다(같은 등수를 나눠 갖지 않는다). */
  rank: number;
  /** 개인 기록은 한 명, 팀 기록은 팀원 전원(고티어 → 저티어 순). */
  players: RecordPlayer[];
  value: number;
  date: string;
  /** 한 경기 기록에만 있다(하루 기록·우승 기록은 null). */
  map: string | null;
  /** 값 옆 작은 설명 — 예: '순위 10 + 킬 22', '4경기'. */
  detail: string | null;
  /**
   * 오른쪽 큰 글씨를 숫자+단위 대신 이 글로 쓴다. 줄 세우는 값(value)과 보여줄 값이
   * 다를 때 — 딜딸러는 '1킬 990딜'.
   */
  valueLabel?: string;
}

export interface RecordBoard {
  id: 'dayKills' | 'matchKills' | 'dayDamage' | 'dealer' | 'matchTeamScore' | 'highestWin' | 'lowestWin';
  /** 개인 기록은 이름 옆에 티어 뱃지를, 팀 기록은 이름만 늘어놓는다. */
  kind: 'player' | 'team';
  title: string;
  description: string;
  unit: string;
  /** 데이터가 이 날짜부터 있다 — 카드 아래에 작게 적는다. */
  since: string;
  entries: RecordEntry[];
  /**
   * 티어 그룹별 순위(카드 안 탭). 있으면 첫 탭이 처음 열린다(entries 는 안 보인다). 없으면 탭 없이
   * entries 만 보여준다 — 지금은 내전 최다 킬만 나눈다(2026-11-15 사용자 결정).
   */
  groups?: RecordGroup[];
}

export interface RecordGroup {
  id: string;
  label: string;
  entries: RecordEntry[];
}

type Candidate = Omit<RecordEntry, 'rank'>;

/**
 * 티어 그룹마다 따로 1~10등을 매긴다. 그룹은 리더보드 탭과 같은 경계(TIER_GROUPS)고,
 * 기록에 오른 사람의 **지금 티어**로 가른다. tiers 가 null 이면 전체.
 * 개인 기록 전용 — 첫 사람의 티어를 본다.
 */
export function rankByTierGroup(
  candidates: Candidate[],
  order: 'desc' | 'asc',
  groups: { id: string; label: string; tiers: number[] | null }[],
): RecordGroup[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    entries: rankTop(
      group.tiers === null
        ? candidates
        : candidates.filter((c) => c.players[0]?.tier != null && group.tiers!.includes(c.players[0].tier)),
      order,
    ),
  }));
}

export const RECORD_LIMIT = 10;

/**
 * 값으로 줄 세워 딱 limit 개만 남긴다(2026-11-15 사용자 결정).
 *
 * 기록이 같으면 **먼저 달성한 쪽(날짜가 이른 쪽)이 위 등수**다 — 같은 등수를 나눠 갖지
 * 않는다. 그래서 등수는 늘 1, 2, 3 … limit 이고, limit 등 뒤에 같은 기록이 더 있어도
 * 자른다. (예전엔 동률을 같은 등수로 묶고 limit 등의 동률을 다 넣어서 16줄까지 늘었다.)
 * 같은 날 같은 기록이면 원래 순서를 지킨다.
 */
export function rankTop(candidates: Candidate[], order: 'desc' | 'asc', limit = RECORD_LIMIT): RecordEntry[] {
  return [...candidates]
    .sort((a, b) =>
      a.value === b.value ? a.date.localeCompare(b.date) : order === 'desc' ? b.value - a.value : a.value - b.value,
    )
    .slice(0, limit)
    .map((c, i) => ({ ...c, rank: i + 1 }));
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

/** 사람 한 명이 한 경기에서 낸 값 — 단일 매치 기록(날짜·맵·그 경기 팀 등수까지). */
export interface SingleGameRow {
  name: string;
  tier: number | null;
  date: string;
  map: string | null;
  teamRank: number;
  value: number;
}

/** 한 경기 한 사람이 그대로 기록 후보 하나다(더하지 않는다). */
export function singleGameCandidates(rows: SingleGameRow[]): Candidate[] {
  return rows.map((r) => ({
    players: [{ name: r.name, tier: r.tier }],
    value: r.value,
    date: r.date,
    map: r.map,
    detail: `팀 ${r.teamRank}등`, // 그 경기 팀 순위 — 기록 등수와 헷갈리지 않게 "팀"을 붙인다
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
      detail: `${t.teamRank}등 · 순위 점수 ${place} + 킬 점수 ${t.kills}`,
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
      detail: `순위 점수 ${r.placePoints} + 킬 점수 ${r.kills}`,
      placePoints: r.placePoints,
      kills: r.kills,
    });
  }
  return [...byDate.values()].map(({ placePoints: _p, kills: _k, ...c }) => ({ ...c, players: byTier(c.players) }));
}

// ---------------------------------------------------------------------------
// 딜딸러 — 킬에 비해 딜량이 높은 경기(2026-11-15 사용자 정의).
//
// 줄 세우는 값 = 딜량 − 킬 × DAMAGE_PER_KILL. "1킬이면 이만큼은 넣는다"를 빼고 남는
// 딜이 클수록 위다. 화면엔 이 계산값이 아니라 '1킬 990딜'처럼 킬과 딜을 그대로 적는다.
// 기준값 185딜 — 클랜원 PUBG API 경기의 총딜 ÷ 총킬(2026-11-15 실측 185.3). "딜딸의 신"
// 뱃지와 같은 정의다. 뱃지는 티어 그룹마다 기준선을 따로 잡지만(176~202) 명예의 전당은
// 티어 무관 순위라 전체 값 하나로 고정했다(사용자 결정). 데이터가 쌓여도 저절로 바뀌지 않는다.
export const DAMAGE_PER_KILL = 185;

export interface DealerRow {
  name: string;
  tier: number | null;
  date: string;
  map: string | null;
  kills: number;
  damage: number;
}

export function dealerCandidates(rows: DealerRow[], damagePerKill = DAMAGE_PER_KILL): Candidate[] {
  return rows.map((r) => ({
    players: [{ name: r.name, tier: r.tier }],
    value: Math.round(r.damage - r.kills * damagePerKill),
    date: r.date,
    map: r.map,
    detail: null,
    valueLabel: `${r.kills}킬 ${Math.round(r.damage).toLocaleString('ko-KR')}딜`,
  }));
}

