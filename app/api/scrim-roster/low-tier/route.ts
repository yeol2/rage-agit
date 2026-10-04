import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// 01 티어 테이블의 "저티어 내전" 토글. 이 명단(내전)이 저티어 내전인지만 바꾼다 —
// 실제 차이는 03 시트에서 우승을 확정할 때 어떤 트로피를 주느냐뿐이다
// (confirm-win 이 이 값을 읽어 session_standings.low_tier 에 박는다).
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
