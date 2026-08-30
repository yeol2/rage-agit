// 깐부 / 사대가 안 맞는 사람 — "누구와 같은 팀일 때 성적이 좋았나".
//
// 재료는 member_partner_stats 뷰(0034)가 다 만들어 준다. 여기서는 자격선을
// 걸고 양 끝 한 명씩을 고른다. 순수 함수가 위, 네트워크는 아래에만 있다.

import { getSupabase } from './supabaseBrowser';

// 같은 팀으로 최소 몇 경기를 치러야 후보인가. 내전 한 번이 4경기이므로 8은
// **서로 다른 내전 두 번 이상** 같은 팀이었다는 뜻이다.
//
// 4(내전 한 번)로 낮추면 조합의 79%가 후보가 되는데, 그 대부분은 그날 팀이
// 잘 굴러갔는지를 말할 뿐 두 사람의 궁합이 아니다. 8이면 후보가 769쌍으로
// 줄지만 클랜원 124명은 여전히 최소 한 명의 후보를 갖는다.
export const MIN_GAMES_TOGETHER = 8;

// 비교 기준(그 사람 없이 치른 경기)도 최소 이만큼은 있어야 한다. 없으면
// "함께일 때 몇 등 좋아졌나"의 기준선 자체가 한두 경기의 우연이 된다.
export const MIN_GAMES_APART = 4;

export interface PartnerStat {
  partnerId: string;
  gamesTogether: number;
  avgRankTogether: number;
  avgRankApart: number;
  /** 양수면 함께일 때 등수가 그만큼 좋아졌다는 뜻(등수는 작을수록 좋다). */
  rankDelta: number;
}

export interface PartnerChemistry {
  /** 함께일 때 성적이 가장 좋아진 사람. 그런 사람이 없으면 null. */
  best: PartnerStat | null;
  /** 함께일 때 성적이 가장 나빠진 사람. 그런 사람이 없으면 null. */
  worst: PartnerStat | null;
}

// 화면이 그대로 그릴 수 있게 이름·티어까지 붙인 모양.
export interface PartnerCard extends PartnerStat {
  displayName: string;
  tier: number;
}

// 양 끝 한 명씩. 차이가 같으면 **더 많이 함께한 쪽**이 이긴다 — 값이 같다면
// 표본이 두꺼운 쪽이 덜 우연이다.
//
// 부호를 지킨다: 차이가 0 이하인 사람은 깐부 자리에 오지 않고, 0 이상인 사람은
// 사대 자리에 오지 않는다. 후보가 한 명뿐일 때 그 한 명이 양쪽에 같이 앉는 것을
// 막는 규칙이기도 하다 — 같이 하면 좋아지면서 동시에 나빠질 수는 없다.
export function pickPartners(rows: PartnerStat[]): PartnerChemistry {
  let best: PartnerStat | null = null;
  let worst: PartnerStat | null = null;

  for (const row of rows) {
    if (row.rankDelta > 0 && (best === null || replaces(row, best, 1))) best = row;
    if (row.rankDelta < 0 && (worst === null || replaces(row, worst, -1))) worst = row;
  }

  return { best, worst };
}

// 후보 a 가 지금 앉아 있는 b 를 밀어내는가. direction 은 어느 쪽 끝을 찾는지다
// (깐부 +1, 사대 -1) — 같은 비교를 부호만 뒤집어 쓴다.
function replaces(a: PartnerStat, b: PartnerStat, direction: 1 | -1): boolean {
  if (a.rankDelta !== b.rankDelta) return a.rankDelta * direction > b.rankDelta * direction;
  return a.gamesTogether > b.gamesTogether;
}

/* ---------- 조회 ---------- */

export async function fetchPartnerStats(memberId: string): Promise<PartnerStat[]> {
  const { data, error } = await getSupabase()
    .from('member_partner_stats')
    .select('partner_id, games_together, avg_rank_together, avg_rank_apart, rank_delta')
    .eq('member_id', memberId)
    .gte('games_together', MIN_GAMES_TOGETHER)
    .gte('games_apart', MIN_GAMES_APART);
  if (error) throw new Error(`깐부 기록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? [])
    // rank_delta 가 null 인 행(함께한 경기가 전부인 사람)은 games_apart 필터에서
    // 이미 걸리지만, 뷰의 null 규칙이 바뀌어도 화면에 NaN 이 뜨지 않게 한 번 더 막는다.
    .filter((row) => row.rank_delta !== null)
    .map((row) => ({
      partnerId: row.partner_id as string,
      gamesTogether: row.games_together as number,
      avgRankTogether: Number(row.avg_rank_together),
      avgRankApart: Number(row.avg_rank_apart),
      rankDelta: Number(row.rank_delta),
    }));
}

// 뽑힌 두 명의 이름만 채운다 — 후보 전원의 이름을 받을 이유가 없다.
export async function fetchPartnerNames(
  partnerIds: string[],
): Promise<Map<string, { discordNickname: string; tier: number }>> {
  if (partnerIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('members')
    .select('id, discord_nickname, tier')
    .in('id', partnerIds);
  if (error) throw new Error(`깐부 이름을 불러오지 못했습니다: ${error.message}`);

  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      { discordNickname: row.discord_nickname as string, tier: row.tier as number },
    ]),
  );
}
