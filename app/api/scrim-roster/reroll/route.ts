import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { computeReroll, type RerollInput } from '@/lib/scrimRoster';

const VALID_TIERS = [1, 2, 3, 4];

// "전체 리롤" / "N티어 리롤" 버튼 — 고정 안 된 사람만 그 티어 칼럼 안에서
// 무작위로 재배치한다. tier 생략 시 1~4 티어 각각 독립적으로 섞는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  if (typeof rosterId !== 'string') {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  let tiers: Array<1 | 2 | 3 | 4> | undefined;
  if (body?.tier !== undefined) {
    if (!VALID_TIERS.includes(body.tier)) {
      return NextResponse.json({ error: 'tier 는 1~4 사이여야 합니다.' }, { status: 400 });
    }
    tiers = [body.tier];
  }

  const supabase = getSupabaseServer();

  const { data: rows, error: fetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, tier_slot, team_number, fixed')
    .eq('roster_id', rosterId);
  if (fetchError) {
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  const entries: RerollInput[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    tierSlot: row.tier_slot as 1 | 2 | 3 | 4 | null,
    teamNumber: row.team_number as number | null,
    fixed: row.fixed as boolean,
  }));

  const changes = computeReroll(entries, tiers);

  if (changes.size > 0) {
    const updateResults = await Promise.all(
      Array.from(changes.entries()).map(([id, teamNumber]) =>
        supabase.from('scrim_roster_entries').update({ team_number: teamNumber }).eq('id', id),
      ),
    );
    if (updateResults.some((result) => result.error)) {
      return NextResponse.json({ error: '리롤 저장에 실패했습니다.' }, { status: 500 });
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
