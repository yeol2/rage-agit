import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// "내전 드가자~" 버튼 전용 — "팀 구성"→'02' 전환은 team-assignments 라우트가
// 대신 처리하므로 여기로는 안 온다. 아직 '02'가 아니면(팀 구성 전이거나 이미
// '03'이면) 400.
export async function PATCH(request: Request, { params }: { params: { rosterId: string } }) {
  const body = await request.json().catch(() => null);
  if (body?.stage !== '03') {
    return NextResponse.json({ error: "stage 는 '03' 이어야 합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: roster, error: fetchError } = await supabase
    .from('scrim_rosters')
    .select('stage')
    .eq('id', params.rosterId)
    .maybeSingle();
  if (fetchError || !roster) {
    return NextResponse.json({ error: '로스터를 찾지 못했습니다.' }, { status: 404 });
  }
  if (roster.stage !== '02') {
    return NextResponse.json(
      { error: `stage 가 '02' 여야 '03' 으로 넘어갈 수 있습니다(현재: '${roster.stage}').` },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from('scrim_rosters')
    .update({ stage: '03' })
    .eq('id', params.rosterId);
  if (updateError) {
    return NextResponse.json({ error: '진행 상태 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ stage: '03' });
}
