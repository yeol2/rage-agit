import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const VALID_SLOTS = [1, 2, 3, 4];

// 드래그 앤 드롭으로 티어 칸을 옮기거나(tierSlot), 02 표에서 클릭으로 고정을
// 토글할 때(fixed) 호출한다. 둘 다 이 entry 하나만 건드리는 부분 업데이트다.
export async function PATCH(request: Request, { params }: { params: { entryId: string } }) {
  const body = await request.json().catch(() => null);
  if (!body || (!('tierSlot' in body) && !('fixed' in body))) {
    return NextResponse.json({ error: 'tierSlot 또는 fixed 값이 필요합니다.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ('tierSlot' in body) {
    const tierSlot = body.tierSlot;
    if (tierSlot !== null && !VALID_SLOTS.includes(tierSlot)) {
      return NextResponse.json({ error: 'tierSlot 값이 올바르지 않습니다.' }, { status: 400 });
    }
    updates.tier_slot = tierSlot;
  }

  if ('fixed' in body) {
    if (typeof body.fixed !== 'boolean') {
      return NextResponse.json({ error: 'fixed 값이 올바르지 않습니다.' }, { status: 400 });
    }
    updates.fixed = body.fixed;
  }

  const { error } = await getSupabaseServer()
    .from('scrim_roster_entries')
    .update(updates)
    .eq('id', params.entryId);

  if (error) {
    return NextResponse.json({ error: '변경 사항을 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
