import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ALL_TIERS } from '@/lib/memberStats';

// 자동 매칭이 못 알아본 사람을 관리자가 닉네임+티어만으로 수동으로 추가한다.
// discord_username 은 NOT NULL 컬럼이라 실제 계정을 모르는 채로도 채워야 하는데,
// 이 사람은 애초에 members 테이블과 매칭시킬 대상이 아니라서(matched=false로 남는다)
// 닉네임 값을 그대로 채워 넣어도 다른 매칭 로직과 충돌하지 않는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  const discordNickname = typeof body?.discordNickname === 'string' ? body.discordNickname.trim() : '';
  const tier = body?.tier;

  if (!rosterId || !discordNickname) {
    return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 });
  }
  if (typeof tier !== 'number' || !ALL_TIERS.includes(tier)) {
    return NextResponse.json({ error: '티어 값이 올바르지 않습니다.' }, { status: 400 });
  }

  const { data, error } = await getSupabaseServer()
    .from('scrim_roster_entries')
    .insert({
      roster_id: rosterId,
      discord_username: discordNickname,
      discord_nickname: discordNickname,
      member_id: null,
      tier,
      tier_slot: null,
      matched: false,
    })
    .select('id, discord_nickname, member_id, tier, tier_slot, matched')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '추가에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    entry: {
      id: data.id,
      discordNickname: data.discord_nickname,
      memberId: data.member_id,
      tier: data.tier,
      tierSlot: data.tier_slot,
      matched: data.matched,
      // 수동 추가한 사람은 members 와 연결되지 않으니 VIP 일 수 없다. 여기서 빼먹으면
      // 화면에서 undefined 가 되어 `!== null` 검사를 통과, 왕관이 잘못 붙는다.
      vipRank: null,
      // 방금 막 추가한 사람이라 아직 팀 배정 전이다.
      teamNumber: null,
    },
  });
}
