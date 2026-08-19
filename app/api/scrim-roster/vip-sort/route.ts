import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { computeVipSort, type VipSortInput } from '@/lib/scrimRoster';

// "VIP 정렬" 버튼 — 내전에 참가 중인 VIP를 등수 오름차순으로 1번팀부터 채워지도록
// 스왑한다. 이미 정렬돼 있으면 아무것도 안 바뀐다(멱등).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  if (typeof rosterId !== 'string') {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: rows, error: fetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, tier_slot, team_number, members(vip_rank)')
    .eq('roster_id', rosterId);
  if (fetchError) {
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  const entries: VipSortInput[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    tierSlot: row.tier_slot as 1 | 2 | 3 | 4 | null,
    teamNumber: row.team_number as number | null,
    vipRank: (Array.isArray(row.members) ? row.members[0] : row.members)?.vip_rank ?? null,
  }));

  const changes = computeVipSort(entries);

  if (changes.size > 0) {
    const updateResults = await Promise.all(
      Array.from(changes.entries()).map(([id, teamNumber]) =>
        supabase.from('scrim_roster_entries').update({ team_number: teamNumber }).eq('id', id),
      ),
    );
    if (updateResults.some((result) => result.error)) {
      return NextResponse.json({ error: 'VIP 정렬 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  const { data: updatedRows, error: refetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, members(vip_rank)')
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
      vipRank: (Array.isArray(row.members) ? row.members[0] : row.members)?.vip_rank ?? null,
    })),
  });
}
