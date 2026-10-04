import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// 03 내전 시트의 "저티어 내전" 토글을 명단에 저장한다(새로고침해도 유지되게) —
// 트로피를 가르는 건 확정 요청에 실려 오는 그 순간의 토글 값이다
// (confirm-win 이 그 값을 session_standings.low_tier 에 박는다).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.rosterId !== 'string' || typeof body.lowTier !== 'boolean') {
    return NextResponse.json({ error: 'rosterId 와 lowTier 값이 필요합니다.' }, { status: 400 });
  }

  const { error } = await getSupabaseServer()
    .from('scrim_rosters')
    .update({ low_tier: body.lowTier })
    .eq('id', body.rosterId);

  if (error) {
    return NextResponse.json({ error: '저티어 내전 설정을 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lowTier: body.lowTier });
}
