// 매치 폴링 파이프라인. Node 스크립트와 Deno Edge Function 이 함께 쓴다.
// 그래서 런타임 전용 API(process, Deno, node:fs)를 쓰지 않는다 —
// 필요한 것은 전부 인자로 받는다.

import { classifyMatch, extractMatchSummary, extractParticipants } from './matches.mjs';
import { scrimSessionTitle, toKstDate } from './sessions.mjs';

const SEED_CANDIDATES = 30; // 참가 기록으로 좁히는 후보 수
const SEED_LIMIT = 8; // 그중 실제로 매치를 열 인원
const SEED_WINDOW_DAYS = 30; // 참가 기록을 얼마나 되돌아볼지
const BATCH_SIZE = 10; // Players 엔드포인트가 한 번에 받는 최대 인원
const REQUEST_INTERVAL = 6500; // 분당 10회 제한 — 6초에 여유를 더한다
const PAGE_SIZE = 1000; // PostgREST 가 한 번에 돌려주는 최대 행 수

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// 씨앗은 "내전에 자주 나오면서 랭크는 적게 하는 사람"이 좋다.
// 실측: 내전 참가 상위 20명 전원이 10경기에 다 나왔지만, 14일간 총 경기 수는
// 39건에서 279건까지 7배 차이났다. 씨앗으로서의 가치는 같은데 열어봐야 할
// 매치 수는 그만큼 차이나므로, 참가 기록으로 후보를 좁힌 뒤 가벼운 쪽을 고른다.
//
// 매치 목록 길이는 Players 응답에 이미 들어 있어 추가 호출이 필요 없다.
export function pickLightSeeds(players, limit) {
  return players
    .map((p) => ({
      accountId: p.id,
      matchCount: p.relationships?.matches?.data?.length ?? 0,
    }))
    .sort((a, b) => a.matchCount - b.matchCount)
    .slice(0, limit)
    .map((p) => p.accountId);
}

// 이미 살펴본 매치는 빼되 목록 순서(최신순)는 그대로 둔다.
//
// 처음에는 "이미 본 매치를 만나면 그 아래는 다 봤을 테니 멈춘다"로 짰는데 틀렸다.
// 조회 실패나 상한 초과로 중간을 건너뛰면 그 자리보다 최신인 매치는 저장돼 있으므로,
// 다음 실행이 첫 항목에서 바로 멈춰 빠뜨린 자리에 영영 도달하지 못한다.
// 건너뛰는 데는 네트워크 호출이 들지 않으므로 끝까지 훑어도 비용이 거의 없다.
export function pendingMatchIds(matchRefs, alreadySeen) {
  return (matchRefs ?? []).map((ref) => ref.id).filter((id) => !alreadySeen.has(id));
}

async function selectAll(supabase, table, columns, applyFilter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyFilter(supabase.from(table).select(columns)).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// 매치가 속할 내전 세션을 찾고, 없으면 만든다.
// 하루 4경기가 한 번에 다 들어오지 않을 수 있으므로(08-09 에 실제로 3경기만
// 먼저 들어왔다) 매치마다 이 함수를 부르고, 같은 날이면 같은 세션에 붙는다.
export async function attachToSession(supabase, { clanId, playedAt }) {
  const scrimDate = toKstDate(playedAt);

  const { data: existing, error: findError } = await supabase
    .from('scrim_sessions')
    .select('id')
    .eq('clan_id', clanId)
    .eq('scrim_date', scrimDate)
    .maybeSingle();
  if (findError) throw new Error(`scrim_sessions 조회 실패: ${findError.message}`);
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('scrim_sessions')
    .insert({ clan_id: clanId, scrim_date: scrimDate, title: scrimSessionTitle(scrimDate) })
    .select('id')
    .single();
  if (insertError) throw new Error(`scrim_sessions 생성 실패: ${insertError.message}`);
  return created.id;
}

// 429 재시도 횟수를 인자로 받는다. 함수는 실행 시간 제한이 있어 한 번만,
// 로컬 스크립트는 여유가 있어 여러 번 시도한다.
async function fetchPlayers(apiKey, accountIds, retriesLeft, log) {
  const res = await fetch(
    `https://api.pubg.com/shards/kakao/players?filter[playerIds]=${accountIds.join(',')}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' } },
  );

  if (res.status === 404) return [];
  if (res.status === 429) {
    if (retriesLeft <= 0) throw new Error('Players 조회가 속도 제한에 걸렸고 재시도 횟수를 다 썼다');
    log('  속도 제한에 걸렸다 — 60초 쉬고 다시 시도한다');
    await sleep(60000);
    return fetchPlayers(apiKey, accountIds, retriesLeft - 1, log);
  }
  if (!res.ok) throw new Error(`Players API 오류 ${res.status}`);

  return (await res.json()).data ?? [];
}

export async function runPolling({
  supabase,
  apiKey,
  sinceHours = 24,
  maxMatches = 200,
  playerRetries = 1,
  log = () => {},
  // 오늘 뛴 참가자가 이미 확정된 경우(예: 03 내전 시트의 "폴링" 버튼 — rosterId로
  // 64명이 이미 정해져 있다) 이 계정 하나만 씨앗으로 쓴다. 없으면(예: 정기
  // 캐치업 스크립트처럼 특정 세션에 묶이지 않은 호출) 아래 "후보 30명 중 가벼운
  // 순" 방식으로 되짚어 찾는다 — 이쪽은 누가 뛰었는지 미리 알 수 없을 때만 쓴다.
  knownAccountId = null,
}) {
  const cutoff = new Date(Date.now() - sinceHours * 3600 * 1000);

  // --- 등록된 클랜원 계정 ---
  const accounts = await selectAll(supabase, 'member_pubg_accounts', 'member_id, pubg_account_id');
  const memberIdByAccountId = new Map(
    accounts.filter((a) => a.pubg_account_id).map((a) => [a.pubg_account_id, a.member_id]),
  );
  if (memberIdByAccountId.size === 0) throw new Error('등록된 클랜원 계정이 없다');
  log(`등록된 클랜원 계정: ${memberIdByAccountId.size}개`);

  // 세션은 클랜에 속한다. 클랜이 정확히 하나여야 어느 세션에 붙일지 알 수 있다.
  const clans = await selectAll(supabase, 'clans', 'id');
  if (clans.length !== 1) throw new Error(`clans 가 ${clans.length}개다 — 정확히 1개여야 한다`);
  const clanId = clans[0].id;

  let seeds;
  if (knownAccountId) {
    seeds = await fetchPlayers(apiKey, [knownAccountId], playerRetries, log);
    log(`고정 씨앗 1명: ${seeds[0]?.attributes?.name ?? knownAccountId}`);
  } else {
    // --- 씨앗 후보: 최근 내전 참가 상위 30명 ---
    const windowStart = new Date(Date.now() - SEED_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const recentMatches = await selectAll(
      supabase,
      'matches',
      'pubg_match_id, match_participants(pubg_account_id, member_id)',
      (q) => q.gte('played_at', windowStart),
    );

    const attendance = new Map();
    for (const match of recentMatches) {
      for (const p of match.match_participants ?? []) {
        if (!p.member_id) continue; // 미등록 참가자는 씨앗으로 쓰지 않는다
        attendance.set(p.pubg_account_id, (attendance.get(p.pubg_account_id) ?? 0) + 1);
      }
    }
    if (attendance.size === 0) {
      throw new Error('내전 참가 기록이 없어 씨앗을 정할 수 없다 — 로컬에서 먼저 수집할 것');
    }

    const candidates = [...attendance.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SEED_CANDIDATES)
      .map(([accountId]) => accountId);

    // --- 후보를 조회하고 가벼운 사람만 남긴다 ---
    const players = [];
    const candidateBatches = chunk(candidates, BATCH_SIZE);
    for (const [i, batch] of candidateBatches.entries()) {
      players.push(...(await fetchPlayers(apiKey, batch, playerRetries, log)));
      if (i < candidateBatches.length - 1) await sleep(REQUEST_INTERVAL);
    }

    const seedAccountIds = new Set(pickLightSeeds(players, SEED_LIMIT));
    seeds = players.filter((p) => seedAccountIds.has(p.id));
    log(
      `씨앗 ${seeds.length}명 (후보 ${players.length}명 중 경기 수가 적은 순): ` +
        seeds
          .map((p) => `${p.attributes.name}(${p.relationships?.matches?.data?.length ?? 0})`)
          .join(', '),
    );
  }

  // --- 이미 살펴본 매치 ---
  const polled = await selectAll(supabase, 'polled_matches', 'pubg_match_id');
  const alreadySeen = new Set(polled.map((r) => r.pubg_match_id));

  // --- 각 씨앗의 목록을 최신순으로 훑는다 ---
  // 이미 살펴본 매치는 건너뛰고(pendingMatchIds), 기준 시각보다 오래된 매치를
  // 만나면 그 아래는 전부 더 오래된 것이므로(목록이 최신순이다 — 실측 확인)
  // 그 사람은 거기서 멈춘다.
  const result = {
    seedsUsed: seeds.length,
    matchesExamined: 0,
    scrimsFound: 0,
    scrims: [],
    unregistered: new Map(),
    truncated: false,
    failedFetches: 0,
  };

  const examined = new Set();

  for (const player of seeds) {
    for (const matchId of pendingMatchIds(player.relationships?.matches?.data, alreadySeen)) {
      if (examined.has(matchId)) continue; // 다른 씨앗과 같이 뛴 경기
      if (result.matchesExamined >= maxMatches) {
        result.truncated = true;
        break;
      }

      const res = await fetch(`https://api.pubg.com/shards/kakao/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' },
      });
      if (!res.ok) {
        // 매치 하나가 실패해도 나머지는 계속한다.
        log(`  ${matchId}: 조회 실패 ${res.status} — 건너뛴다`);
        result.failedFetches++;
        continue;
      }

      const body = await res.json();
      const summary = extractMatchSummary(body);
      examined.add(matchId);
      result.matchesExamined++;

      if (new Date(summary.playedAt) < cutoff) break; // 기준보다 오래됐다 — 이 사람은 여기까지

      const participants = extractParticipants(body, memberIdByAccountId);
      const clanMemberCount = participants.filter((p) => p.memberId).length;
      const verdict = classifyMatch({
        matchType: summary.matchType,
        participantCount: summary.participantCount,
        clanMemberCount,
        participants,
        durationSeconds: summary.durationSeconds,
      });

      const { error: polledError } = await supabase
        .from('polled_matches')
        .upsert(
          { pubg_match_id: matchId, is_scrim: verdict.isScrim, reason: verdict.reason },
          { onConflict: 'pubg_match_id' },
        );
      if (polledError) throw new Error(`polled_matches 기록 실패: ${polledError.message}`);

      if (!verdict.isScrim) continue;

      log(`  내전 발견: ${summary.playedAt}  ${verdict.reason}`);

      const sessionId = await attachToSession(supabase, {
        clanId,
        playedAt: summary.playedAt,
      });

      const { error: matchError } = await supabase.from('matches').upsert(
        {
          pubg_match_id: summary.pubgMatchId,
          played_at: summary.playedAt,
          match_type: summary.matchType,
          game_mode: summary.gameMode,
          map_name: summary.mapName,
          duration_seconds: summary.durationSeconds,
          participant_count: summary.participantCount,
          clan_member_count: clanMemberCount,
          raw_attributes: summary.rawAttributes,
          scrim_session_id: sessionId,
        },
        { onConflict: 'pubg_match_id' },
      );
      if (matchError) throw new Error(`matches 저장 실패: ${matchError.message}`);

      const { error: participantError } = await supabase.from('match_participants').upsert(
        participants.map((p) => ({
          pubg_match_id: summary.pubgMatchId,
          member_id: p.memberId,
          pubg_account_id: p.pubgAccountId,
          pubg_ign: p.pubgIgn,
          team_id: p.teamId,
          team_rank: p.teamRank,
          kills: p.kills,
          assists: p.assists,
          damage_dealt: p.damageDealt,
          dbnos: p.dbnos,
          headshot_kills: p.headshotKills,
          win_place: p.winPlace,
          time_survived: p.timeSurvived,
          heals: p.heals,
          boosts: p.boosts,
          longest_kill: p.longestKill,
          revives: p.revives,
          walk_distance: p.rawStats.walkDistance ?? null,
          ride_distance: p.rawStats.rideDistance ?? null,
          raw_stats: p.rawStats,
        })),
        { onConflict: 'pubg_match_id,pubg_account_id' },
      );
      if (participantError) {
        throw new Error(`match_participants 저장 실패: ${participantError.message}`);
      }

      result.scrimsFound++;
      result.scrims.push({
        playedAt: summary.playedAt,
        participantCount: summary.participantCount,
        clanMemberCount,
      });
      for (const p of participants.filter((p) => !p.memberId)) {
        result.unregistered.set(p.pubgIgn, (result.unregistered.get(p.pubgIgn) ?? 0) + 1);
      }
    }
    if (result.truncated) break;
  }

  return result;
}
