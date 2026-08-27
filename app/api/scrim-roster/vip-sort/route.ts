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

  // 여러 행을 SQL 문 하나로 묶어 바꾼다(0030) — 개별 요청을 동시에 날리던
  // 예전 방식은 그중 하나만 실패해도 나머지는 이미 커밋돼버려서, 03 표에
  // 그 한 자리만 빈 칸으로 남는 문제가 있었다.
  if (changes.size > 0) {
    const { error: updateError } = await supabase.rpc('apply_team_number_updates', {
      updates: Array.from(changes.entries()).map(([id, teamNumber]) => ({ id, teamNumber })),
    });
    if (updateError) {
      return NextResponse.json({ error: 'VIP 정렬 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  // 정렬을 명시하지 않으면 Postgres 가 행을 어떤 순서로 돌려줄지는 보장이 없다 —
  // 02 화면은 같은 티어 안에서 이 배열 순서로 동점자를 나열하므로, 정렬 없이
  // 받은 순서를 그대로 쓰면 같은 상태를 봐도 사람마다, 누를 때마다 카드 줄이
  // 달라 보인다.
  const { data: updatedRows, error: refetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, fixed, members(vip_rank)')
    .eq('roster_id', rosterId)
    .order('id', { ascending: true });
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
