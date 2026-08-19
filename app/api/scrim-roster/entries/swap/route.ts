import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// 02 표에서 같은 티어 칼럼 안의 두 사람을 클릭으로 맞바꿀 때 호출한다. 개별 PATCH를
// 두 번 부르면 하나만 저장되고 하나는 실패하는 상태가 생길 수 있어 한 번에 처리한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const entryIdA = body?.entryIdA;
  const entryIdB = body?.entryIdB;
  if (typeof entryIdA !== 'string' || typeof entryIdB !== 'string') {
    return NextResponse.json({ error: 'entryIdA, entryIdB 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: rows, error: fetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, tier_slot, team_number')
    .in('id', [entryIdA, entryIdB]);
  if (fetchError || !rows) {
    return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });
  }

  const entryA = rows.find((row) => row.id === entryIdA);
  const entryB = rows.find((row) => row.id === entryIdB);
  if (!entryA || !entryB) {
    return NextResponse.json({ error: '대상을 찾지 못했습니다.' }, { status: 400 });
  }
  if (entryA.tier_slot !== entryB.tier_slot) {
    return NextResponse.json({ error: '같은 티어 칸끼리만 맞바꿀 수 있습니다.' }, { status: 400 });
  }

  const [resultA, resultB] = await Promise.all([
    supabase.from('scrim_roster_entries').update({ team_number: entryB.team_number }).eq('id', entryIdA),
    supabase.from('scrim_roster_entries').update({ team_number: entryA.team_number }).eq('id', entryIdB),
  ]);
  if (resultA.error || resultB.error) {
    return NextResponse.json({ error: '팀 번호 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
