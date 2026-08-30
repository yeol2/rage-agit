import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buildRoundSheet } from '@/lib/roundSheetData';

// 종합우승은 그날 라운드를 다 치른 뒤에야 정해진다. 한두 라운드만 기록된 상태로
// 확정하면 그때까지 앞서 있던 팀이 우승으로 박힌다.
const REQUIRED_ROUNDS = 4;

/**
 * 03 내전 시트의 "우승 확정" 버튼.
 *
 * 이름은 "우승 확정"이지만 저장하는 건 그날 **1~16위 전부**다 (0028). 우승만
 * 남기면 클랜원 화면의 "최근 N회 내전 종합등수" 줄이 볼 게 없고, 나중에
 * 계산으로 되짚을 수도 없기 때문이다 — 탈퇴자 정리가 참가 기록을 행째로 지워서
 * 팀 킬 합계가 미달되고, 총점 = 순위점수 + 킬이라 순위가 뒤집힌다(0027 참고).
 * 그래서 확정 시점의 값을 그대로 박아둔다.
 *
 * 등수는 클라이언트가 보낸 값을 믿지 않고 서버에서 시트를 다시 만들어 구한다
 * (buildRoundSheet 을 시트 조회와 같이 쓴다). 화면에 보이는 것과 저장되는 것이
 * 어긋날 수 없다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scrimDate = typeof body.scrimDate === 'string' ? body.scrimDate : null;
  if (!scrimDate) {
    return NextResponse.json({ error: 'scrimDate 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  let sheet;
  try {
    sheet = await buildRoundSheet(supabase, scrimDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '시트를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }

  if (!sheet.scrimDate) {
    return NextResponse.json({ error: '아직 내전 세션이 없습니다.' }, { status: 400 });
  }
  if (sheet.roundCount < REQUIRED_ROUNDS) {
    return NextResponse.json(
      { error: `${REQUIRED_ROUNDS}경기가 다 기록돼야 확정할 수 있습니다 (지금 ${sheet.roundCount}경기).` },
      { status: 400 },
    );
  }

  const winner = sheet.teams.find((team) => team.standing === 1);
  if (!winner || winner.memberIds.length === 0) {
    return NextResponse.json({ error: '우승팀을 찾지 못했습니다.' }, { status: 400 });
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
    return NextResponse.json({ error: '기존 등수 기록을 정리하지 못했습니다.' }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('session_standings').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: '등수 기록을 저장하지 못했습니다.' }, { status: 500 });
  }

  // 우승 횟수(뱃지 열·클랜원 화면)와 종합등수 줄이 바로 보여야 한다.
  revalidatePath('/dashboard');
  revalidatePath('/members');

  return NextResponse.json({
    scrimDate: sheet.scrimDate,
    teamNumber: winner.teamNumber,
    totalScore: winner.totalScore,
    players: winner.players,
    // 몇 팀·몇 명이 실제로 기록됐는지 — 매칭이 덜 된 채로 확정한 걸 화면에서
    // 알아챌 수 있게 같이 돌려준다.
    savedTeams: new Set(rows.map((row) => row.standing)).size,
    savedMembers: rows.length,
  });
}
