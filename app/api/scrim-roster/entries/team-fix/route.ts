import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// "고정" 칼럼 — 팀 행 하나를 누르면 그 팀(같은 roster, 같은 team_number) 4명
// 전체의 fixed를 한 번에 지정한 값으로 맞춘다. 목표값은 클라이언트가 계산해서
// 보낸다(현재 상태 조회 없이 바로 update).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  const teamNumber = body?.teamNumber;
  const fixed = body?.fixed;

  if (typeof rosterId !== 'string' || typeof teamNumber !== 'number' || typeof fixed !== 'boolean') {
    return NextResponse.json({ error: 'rosterId, teamNumber, fixed 가 필요합니다.' }, { status: 400 });
  }

  const { error } = await getSupabaseServer()
    .from('scrim_roster_entries')
    .update({ fixed })
    .eq('roster_id', rosterId)
    .eq('team_number', teamNumber);

  if (error) {
    return NextResponse.json({ error: '팀 고정 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
