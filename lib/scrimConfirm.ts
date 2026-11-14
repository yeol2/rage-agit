import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';
import { SCORE_HISTORY_TAG } from '@/lib/scoreHistoryData';
import { revalidateRecordPages } from '@/lib/revalidateRecordPages';
import { buildRoundSheet, type RoundSheetTeam } from '@/lib/roundSheetData';
import { captureRankingSnapshotForRoster } from '@/lib/rankingSnapshot';

// 03 내전 시트의 "우승 확정" 버튼과 목·일 자동 확정(크론)이 같이 쓰는 본체.

// 내전우승은 그날 라운드를 다 치른 뒤에야 정해진다. 한두 라운드만 기록된 상태로
// 확정하면 그때까지 앞서 있던 팀이 우승으로 박힌다.
export const REQUIRED_ROUNDS = 4;

export type ConfirmScrimResult =
  | {
      ok: true;
      scrimDate: string;
      teamNumber: number;
      totalScore: number;
      players: string[];
      lowTier: boolean;
      savedTeams: number;
      savedMembers: number;
      /** standing 순으로 정렬된 전체 팀 — 자동 확정 알림이 상위권을 적을 때 쓴다. */
      teams: RoundSheetTeam[];
    }
  | { ok: false; status: number; error: string };

/**
 * 이름은 "우승 확정"이지만 저장하는 건 그날 **1~16위 전부**다 (0028). 우승만
 * 남기면 클랜원 화면의 "최근 N회 내전 종합등수" 줄이 볼 게 없고, 나중에
 * 계산으로 되짚을 수도 없기 때문이다 — 탈퇴자 정리가 참가 기록을 행째로 지워서
 * 팀 킬 합계가 미달되고, 총점 = 순위점수 + 킬이라 순위가 뒤집힌다(0027 참고).
 * 그래서 확정 시점의 값을 그대로 박아둔다.
 *
 * 등수는 호출하는 쪽이 보낸 값을 믿지 않고 서버에서 시트를 다시 만들어 구한다
 * (buildRoundSheet 을 시트 조회와 같이 쓴다). 화면에 보이는 것과 저장되는 것이
 * 어긋날 수 없다.
 */
export async function confirmScrimWin(
  supabase: SupabaseClient,
  {
    scrimDate,
    rosterId,
    lowTier,
  }: {
    scrimDate: string;
    /** 등수 변동 스냅샷을 한 번만 찍기 위한 표시가 명단에 있다. 명단이 없으면 안 찍는다. */
    rosterId: string | null;
    /**
     * 저티어 내전이면 우승팀이 내전우승 트로피 대신 "꽃게들의 왕"을 받는다(0045).
     * 버튼은 그 순간의 토글 값을, 크론은 명단에 저장된 토글 값을 넘긴다.
     */
    lowTier: boolean;
  },
): Promise<ConfirmScrimResult> {
  let sheet;
  try {
    sheet = await buildRoundSheet(supabase, scrimDate);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : '시트를 불러오지 못했습니다.',
    };
  }

  if (!sheet.scrimDate) {
    return { ok: false, status: 400, error: '아직 내전 세션이 없습니다.' };
  }
  if (sheet.roundCount < REQUIRED_ROUNDS) {
    return {
      ok: false,
      status: 400,
      error: `${REQUIRED_ROUNDS}경기가 다 기록돼야 확정할 수 있습니다 (지금 ${sheet.roundCount}경기).`,
    };
  }

  const winner = sheet.teams.find((team) => team.standing === 1);
  if (!winner || winner.memberIds.length === 0) {
    return { ok: false, status: 400, error: '우승팀을 찾지 못했습니다.' };
  }

  // 등수는 팀 단위지만 표는 사람 단위다 — 팀원 4명이 같은 standing 을 나눠 갖는다.
  // 매칭된 클랜원이 하나도 없는 팀(탈퇴자·게스트만 있던 팀)은 남길 행이 없어
  // 자연히 빠진다. 그 팀의 standing 번호는 그대로 비게 되는데, 그게 맞다 —
  // 남은 사람들의 등수를 당겨 매기면 실제 시트와 어긋난다.
  const rows = sheet.teams.flatMap((team) =>
    team.memberIds.map((memberId) => ({
      scrim_date: sheet.scrimDate,
      session_number: 1,
      standing: team.standing,
      team_no: team.teamNumber,
      place_points: team.totalPlacementPoints,
      kills: team.totalKills,
      total_score: team.totalScore,
      member_id: memberId,
      low_tier: lowTier,
      source: 'match',
      note: `내전 시트에서 확정 (${team.totalScore}점)`,
    })),
  );

  // 이미 확정한 세션을 다시 누르면 그때 값으로 덮어써야 한다 — 뒤늦게 붙은
  // 경기나 고쳐진 팀 배정이 반영되지 않으면 화면과 기록이 어긋난다.
  // (날짜, 세션번호, 클랜원) 유일 제약이 있으므로 같은 날짜를 먼저 지운다.
  const { error: deleteError } = await supabase
    .from('session_standings')
    .delete()
    .eq('scrim_date', sheet.scrimDate)
    .eq('session_number', 1);
  if (deleteError) {
    return { ok: false, status: 500, error: '기존 등수 기록을 정리하지 못했습니다.' };
  }

  const { error: insertError } = await supabase.from('session_standings').insert(rows);
  if (insertError) {
    return { ok: false, status: 500, error: '등수 기록을 저장하지 못했습니다.' };
  }

  // 리더보드·지표는 확정된 일반 내전만 센다(0047) — 바로 위 insert 로 이 내전이
  // 집계에 들어갔으니, 리더보드를 갱신하기 전에 등수 변동 스냅샷을 찍는다.
  // 저티어 내전은 집계가 안 바뀌므로 찍지 않는다(찍으면 변동 표시가 전부 지워진다).
  // 로스터마다 한 번만 찍히므로 확정을 다시 눌러도 안전하다. 스냅샷은 부수
  // 효과라 실패해도 확정 자체는 성공으로 돌려준다.
  if (!lowTier && rosterId) {
    await captureRankingSnapshotForRoster(supabase, rosterId).catch(() => null);
  }

  // 점수 변동 그래프의 캐시부터 버린다 — 이 내전이 점수에 막 들어갔으니, 아래에서
  // 다시 그려질 리더보드·클랜원 화면이 옛 이력을 읽으면 그래프만 한 칸 늦는다.
  revalidateTag(SCORE_HISTORY_TAG);
  // 우승 횟수(뱃지 열·클랜원 화면)와 종합등수 줄, 리더보드 집계가 바로 보여야 한다.
  revalidatePath('/dashboard');
  revalidateRecordPages();

  return {
    ok: true,
    scrimDate: sheet.scrimDate,
    teamNumber: winner.teamNumber,
    totalScore: winner.totalScore,
    players: winner.players,
    lowTier,
    // 몇 팀·몇 명이 실제로 기록됐는지 — 매칭이 덜 된 채로 확정한 걸 알아챌 수 있게.
    savedTeams: new Set(rows.map((row) => row.standing)).size,
    savedMembers: rows.length,
    teams: [...sheet.teams].sort((a, b) => a.standing - b.standing),
  };
}
