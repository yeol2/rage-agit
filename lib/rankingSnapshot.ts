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
  rankPosition: number;
}

// group_id 는 TIER_GROUPS.id 그대로 쓴다('all' + 티어 그룹들) — 리더보드
// 탭과 정확히 대응시켜, 어느 탭에서 보든 그 탭 기준 등수 변화가 나오게 한다.
export function computeSnapshotRows(
  recent16Rows: RankingStatsRow[],
  alltimeRows: RankingStatsRow[],
): RankingSnapshotRow[] {
  const byWindow: Array<[RankingWindow, RankingStatsRow[]]> = [
    ['recent16', recent16Rows],
    ['alltime', alltimeRows],
  ];
  const result: RankingSnapshotRow[] = [];

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
    .select('ranking_window, group_id, member_id, rank_position');
  if (error) throw new Error(`등수 스냅샷을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    window: row.ranking_window as RankingWindow,
    groupId: row.group_id as string,
    memberId: row.member_id as string,
    rankPosition: row.rank_position as number,
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
  const rows = computeSnapshotRows(recent16Rows, alltimeRows);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from('ranking_snapshots').upsert(
      rows.map((row) => ({
        ranking_window: row.window,
        group_id: row.groupId,
        member_id: row.memberId,
        rank_position: row.rankPosition,
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
