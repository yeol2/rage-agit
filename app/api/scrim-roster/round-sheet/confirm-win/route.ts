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
 * 우승팀은 클라이언트가 보낸 값을 믿지 않고 서버에서 시트를 다시 만들어 구한다
 * (buildRoundSheet 을 시트 조회와 같이 쓴다). 화면에 보이는 것과 저장되는 것이
 * 어긋날 수 없다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;
  if (!rosterId) {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  let sheet;
  try {
    sheet = await buildRoundSheet(supabase, rosterId);
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

  // 이미 확정한 세션을 다시 누르면 아무 일도 안 일어나야 한다. (날짜, 세션번호,
  // 클랜원) 유일 제약이 있으므로 upsert 로 조용히 넘긴다 — 다만 우승팀을 잘못
  // 확정했다가 고치는 경우를 위해, 같은 날짜의 기존 기록은 먼저 지운다.
  const { error: deleteError } = await supabase
    .from('session_wins')
    .delete()
    .eq('scrim_date', sheet.scrimDate)
    .eq('session_number', 1);
  if (deleteError) {
    return NextResponse.json({ error: '기존 우승 기록을 정리하지 못했습니다.' }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('session_wins').insert(
    winner.memberIds.map((memberId) => ({
      scrim_date: sheet.scrimDate,
      session_number: 1,
      team_no: null, // 매치 데이터에는 세션 단위 팀번호가 없다 (PUBG team_id 는 매치마다 바뀐다)
      member_id: memberId,
      source: 'match',
      note: `내전 시트에서 확정 (${winner.totalScore}점)`,
    })),
  );
  if (insertError) {
    return NextResponse.json({ error: '우승 기록을 저장하지 못했습니다.' }, { status: 500 });
  }

  // 우승 횟수는 리더보드 뱃지 열과 클랜원 화면에 바로 보여야 한다.
  revalidatePath('/dashboard');
  revalidatePath('/members');

  return NextResponse.json({
    scrimDate: sheet.scrimDate,
    teamNumber: winner.teamNumber,
    totalScore: winner.totalScore,
    players: winner.players,
  });
}
