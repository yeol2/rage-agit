import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

interface UndoChange {
  id: string;
  teamNumber: number;
}

// 리롤 되돌리기 버튼 — 클라이언트가 리롤 직전 스냅샷과 지금 상태를 비교해 뽑아낸
// {id, teamNumber} 목록을 그대로 다시 써넣는다. 재계산 없이 순수 복원만 한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  const changes = body?.changes;
  if (typeof rosterId !== 'string' || !Array.isArray(changes)) {
    return NextResponse.json({ error: 'rosterId 와 changes 가 필요합니다.' }, { status: 400 });
  }
  const isValid = (changes as unknown[]).every(
    (change): change is UndoChange =>
      typeof (change as UndoChange)?.id === 'string' &&
      typeof (change as UndoChange)?.teamNumber === 'number',
  );
  if (!isValid) {
    return NextResponse.json({ error: 'changes 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  if (changes.length > 0) {
    const updateResults = await Promise.all(
      (changes as UndoChange[]).map((change) =>
        supabase.from('scrim_roster_entries').update({ team_number: change.teamNumber }).eq('id', change.id),
      ),
    );
    if (updateResults.some((result) => result.error)) {
      return NextResponse.json({ error: '되돌리기에 실패했습니다.' }, { status: 500 });
    }
  }

  const { data: updatedRows, error: refetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, fixed, members(vip_rank)')
    .eq('roster_id', rosterId);
  if (refetchError || !updatedRows) {
    return NextResponse.json({ error: '갱신된 명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    entries: updatedRows.map((row) => ({
      id: row.id,
      discordNickname: row.discord_nickname,
      memberId: row.member_id,
      tier: row.tier,
      tierSlot: row.tier_slot,
      matched: row.matched,
      teamNumber: row.team_number,
      fixed: row.fixed,
      vipRank: (Array.isArray(row.members) ? row.members[0] : row.members)?.vip_rank ?? null,
    })),
  });
}
