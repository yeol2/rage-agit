import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const VALID_SLOTS = [1, 2, 3, 4];

// 드래그 앤 드롭으로 사람을 다른 티어 칸이나 미매칭(null)으로 옮겼을 때 호출한다 —
// tier_slot만 바꾼다. tier(실제 티어 값)나 매칭 상태는 건드리지 않는다.
export async function PATCH(request: Request, { params }: { params: { entryId: string } }) {
  const body = await request.json().catch(() => null);
  if (!body || !('tierSlot' in body)) {
    return NextResponse.json({ error: 'tierSlot 값이 필요합니다.' }, { status: 400 });
  }
  const tierSlot = body.tierSlot;

  if (tierSlot !== null && !VALID_SLOTS.includes(tierSlot)) {
    return NextResponse.json({ error: 'tierSlot 값이 올바르지 않습니다.' }, { status: 400 });
  }

  const { error } = await getSupabaseServer()
    .from('scrim_roster_entries')
    .update({ tier_slot: tierSlot })
    .eq('id', params.entryId);

  if (error) {
    return NextResponse.json({ error: '티어 칸 변경에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
