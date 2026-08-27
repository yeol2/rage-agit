import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// 02 화면이 팀 구성 실패("1~4티어가 모두 채워져야") 를 받았을 때 다시 부르는
// 가벼운 조회 — 다른 관리자가 그 사이 로스터를 바꿔서 이 화면의 entries 가
// 오래된 상태였을 수 있다(같은 값을 보고도 서버는 다르게 판단한 것). 매번
// 전체 페이지를 새로고침하는 대신 entries 배열만 다시 받아 그 자리에서 바로잡는다.
export async function GET(request: Request) {
  const rosterId = new URL(request.url).searchParams.get('rosterId');
  if (!rosterId) {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  // lib/scrimRoster.ts 의 fetchLatestRoster 와 같은 select/정렬 — 카드 순서가
  // 화면마다 다르게 보이지 않으려면(0030 참고) 항상 id 오름차순이어야 한다.
  const { data, error } = await getSupabaseServer()
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, fixed, members(vip_rank)')
    .eq('roster_id', rosterId)
    .order('id', { ascending: true });
  if (error) {
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    entries: (data ?? []).map((row) => ({
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
