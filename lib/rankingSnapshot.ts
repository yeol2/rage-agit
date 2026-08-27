// 등수 스냅샷 — 내전 세션이 끝날 때마다 종합점수 순위를 저장해뒀다가, 다음에
// 볼 때 상승/하락/신규를 비교하는 데 쓴다. 순수 계산은 이 파일에서(Supabase
// 없이 테스트), 실제 조회/캡처는 파일 뒷부분(export async 함수)에만 있다.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabaseBrowser';
import { TIER_GROUPS } from './dashboardData';
import {
  RAGE_SCORE_STEEPNESS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  fetchRankingStats,
  topByRageScore,
  type RankingStatsRow,
  type RankingWindow,
} from './rankingStats';

export interface RankingSnapshotRow {
  window: RankingWindow;
  groupId: string;
  memberId: string;
  // 이번 캡처 시점("지금") 등수 — 다음 캡처가 previousRankPosition 으로 삼을
  // 재료일 뿐, 화면은 이 값을 직접 비교에 쓰지 않는다(캡처 직후엔 항상 실시간
  // 등수와 같아지므로 비교 기준이 못 된다 — 0031 참고).
  rankPosition: number;
  // 그 앞 캡처(직전 세션) 시점의 등수 — 화면의 변동 배지가 비교하는 진짜 기준.
  // 그 전에 한 번도 캡처된 적이 없으면 null("신규"로 보인다).
  previousRankPosition: number | null;
}

// computeSnapshotRows 는 "지금 이 순간의 등수"만 계산한다 — 그 등수가 지난
// 캡처보다 오르내렸는지는 모른다(그건 이력을 아는 attachPreviousRanks 의 몫).
// 두 함수를 나눠야 각각 순수하게 테스트된다: 하나는 "등수를 어떻게 매기는가",
// 하나는 "그 등수를 지난 캡처와 어떻게 짝짓는가".
export interface SnapshotRankRow {
  window: RankingWindow;
  groupId: string;
  memberId: string;
  rankPosition: number;
}

// group_id 는 TIER_GROUPS.id 그대로 쓴다('all' + 티어 그룹들) — 리더보드
// 탭과 정확히 대응시켜, 어느 탭에서 보든 그 탭 기준 등수 변화가 나오게 한다.
export function computeSnapshotRows(
  recent16Rows: RankingStatsRow[],
  alltimeRows: RankingStatsRow[],
): SnapshotRankRow[] {
  const byWindow: Array<[RankingWindow, RankingStatsRow[]]> = [
    ['recent16', recent16Rows],
    ['alltime', alltimeRows],
  ];
  const result: SnapshotRankRow[] = [];

  for (const [window, rows] of byWindow) {
    const eligible = eligibleForRanking(rows);
    for (const group of TIER_GROUPS) {
      const groupRows =
        group.tiers === null ? eligible : eligible.filter((row) => group.tiers!.includes(row.tier));
      const ranked = topByRageScore(groupRows, TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS, groupRows.length);
      ranked.forEach((row, index) => {
        result.push({ window, groupId: group.id, memberId: row.memberId, rankPosition: index + 1 });
      });
    }
  }
  return result;
}

// (window, groupId, memberId) 세 값으로 스냅샷 한 줄을 가리키는 키 — DB의
// unique 제약(ranking_window, group_id, member_id)과 정확히 대응한다.
export function snapshotKey(row: { window: RankingWindow; groupId: string; memberId: string }): string {
  return `${row.window}|${row.groupId}|${row.memberId}`;
}

// 새로 계산한 등수(newRows)에, 덮어쓰기 전 DB 에 있던 값(previousRankPositionByKey
// — 지난 세션이 끝났을 때 캡처된 등수)을 previousRankPosition 으로 붙인다.
// 그 조합이 전에 없었으면(그 사람의 첫 캡처, 또는 이 스냅샷 기능 도입 전이라
// 기록이 없는 경우) null 이 되어 화면에 "신규"로 보인다.
export function attachPreviousRanks(
  newRows: SnapshotRankRow[],
  previousRankPositionByKey: Map<string, number>,
): RankingSnapshotRow[] {
  return newRows.map((row) => ({
    ...row,
    previousRankPosition: previousRankPositionByKey.get(snapshotKey(row)) ?? null,
  }));
}

export type RankChange = { type: 'new' } | { type: 'up'; delta: number } | { type: 'down'; delta: number };

export function computeRankChange(currentRank: number, previousRank: number | undefined): RankChange | null {
  if (previousRank === undefined) return { type: 'new' };
  if (currentRank < previousRank) return { type: 'up', delta: previousRank - currentRank };
  if (currentRank > previousRank) return { type: 'down', delta: currentRank - previousRank };
  return null;
}

// 화면(TierRankingPodium)이 읽는 쪽 — anon 키로 읽기만 한다.
export async function fetchRankingSnapshots(): Promise<RankingSnapshotRow[]> {
  const { data, error } = await getSupabase()
    .from('ranking_snapshots')
    .select('ranking_window, group_id, member_id, rank_position, previous_rank_position');
  if (error) throw new Error(`등수 스냅샷을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    window: row.ranking_window as RankingWindow,
    groupId: row.group_id as string,
    memberId: row.member_id as string,
    rankPosition: row.rank_position as number,
    previousRankPosition: row.previous_rank_position as number | null,
  }));
}

// 03 폴링이 라운드 4개 도달을 감지했을 때 호출한다(캡처 API 라우트도 이
// 함수를 그대로 가져다 쓴다). 이미 캡처된 로스터면 아무것도 안 하고
// { captured: false } 를 낸다 — 여러 번 호출돼도 안전하다.
export async function captureRankingSnapshotForRoster(
  supabase: SupabaseClient,
  rosterId: string,
): Promise<{ captured: boolean }> {
  const { data: rosterRow, error: rosterError } = await supabase
    .from('scrim_rosters')
    .select('ranking_snapshot_captured_at')
    .eq('id', rosterId)
    .maybeSingle();
  if (rosterError) throw new Error(`로스터를 조회하지 못했습니다: ${rosterError.message}`);
  if (!rosterRow || rosterRow.ranking_snapshot_captured_at) {
    return { captured: false };
  }

  const [recent16Rows, alltimeRows] = await Promise.all([
    fetchRankingStats('recent16'),
    fetchRankingStats('alltime'),
  ]);
  const newRows = computeSnapshotRows(recent16Rows, alltimeRows);

  // 덮어쓰기 전에 지금 rank_position 에 있는 값(=지난 세션이 끝났을 때 캡처된
  // 등수)을 먼저 읽어 previousRankPosition 으로 옮겨 심는다 — 안 그러면 이번
  // 캡처가 곧바로 그 값을 "지금 등수"로 덮어써서 지난 세션 결과가 사라진다(0031).
  const { data: existingRows, error: existingError } = await supabase
    .from('ranking_snapshots')
    .select('ranking_window, group_id, member_id, rank_position');
  if (existingError) throw new Error(`이전 등수 스냅샷을 불러오지 못했습니다: ${existingError.message}`);
  const previousRankPositionByKey = new Map(
    (existingRows ?? []).map((row) => [
      snapshotKey({
        window: row.ranking_window as RankingWindow,
        groupId: row.group_id as string,
        memberId: row.member_id as string,
      }),
      row.rank_position as number,
    ]),
  );
  const rows = attachPreviousRanks(newRows, previousRankPositionByKey);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from('ranking_snapshots').upsert(
      rows.map((row) => ({
        ranking_window: row.window,
        group_id: row.groupId,
        member_id: row.memberId,
        rank_position: row.rankPosition,
        previous_rank_position: row.previousRankPosition,
        captured_at: new Date().toISOString(),
      })),
      { onConflict: 'ranking_window,group_id,member_id' },
    );
    if (upsertError) throw new Error(`등수 스냅샷 저장에 실패했습니다: ${upsertError.message}`);
  }

  const { error: updateError } = await supabase
    .from('scrim_rosters')
    .update({ ranking_snapshot_captured_at: new Date().toISOString() })
    .eq('id', rosterId);
  if (updateError) throw new Error(`캡처 시각 저장에 실패했습니다: ${updateError.message}`);

  return { captured: true };
}
