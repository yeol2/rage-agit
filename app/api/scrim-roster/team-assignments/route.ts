import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { assignTeamNumbers, type TeamAssignmentInput } from '@/lib/scrimRoster';

const TIER_SLOTS = [1, 2, 3, 4] as const;

// components/team-builder/RosterBoard.tsx 의 targetPerTierFor() 와 같은 규칙이다
// (참가 인원을 4로 나눈 반올림값). 화면이 이미 "팀 구성" 버튼을 그 규칙으로
// 활성화/비활성화하지만, 그 사이 명단이 바뀌었을 수 있어 서버에서 다시 검증한다.
function targetPerTierFor(totalCount: number): number {
  return totalCount > 0 ? Math.round(totalCount / 4) : 16;
}

// "팀 구성" 버튼을 누르면 호출된다 — 01 티어 테이블에 보이는 순서 그대로 팀
// 번호를 계산해 저장하고, 갱신된 전체 명단을 돌려준다(클라이언트가 재조회 없이
// 02 표를 바로 채울 수 있게).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  if (typeof rosterId !== 'string') {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: rows, error: fetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, tier, tier_slot')
    .eq('roster_id', rosterId);
  if (fetchError) {
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  const entries: TeamAssignmentInput[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    tier: row.tier as number | null,
    tierSlot: row.tier_slot as 1 | 2 | 3 | 4 | null,
  }));

  const targetPerTier = targetPerTierFor(entries.length);
  const allTiersFull = TIER_SLOTS.every(
    (slot) => entries.filter((entry) => entry.tierSlot === slot).length === targetPerTier,
  );
  if (entries.length === 0 || !allTiersFull) {
    return NextResponse.json(
      { error: '1~4티어가 모두 정확히 채워져야 팀을 구성할 수 있습니다.' },
      { status: 400 },
    );
  }

  const teamNumberById = assignTeamNumbers(entries);

  const updateResults = await Promise.all(
    Array.from(teamNumberById.entries()).map(([id, teamNumber]) =>
      supabase.from('scrim_roster_entries').update({ team_number: teamNumber }).eq('id', id),
    ),
  );
  if (updateResults.some((result) => result.error)) {
    return NextResponse.json({ error: '팀 번호 저장에 실패했습니다.' }, { status: 500 });
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
