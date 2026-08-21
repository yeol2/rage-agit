import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { runPolling } from '@/supabase/functions/_shared/polling.mjs';

// 03 내전 시트의 "폴링" 버튼 — 방금 끝난 매치 하나를 잡으러 짧은 시간창으로
// 기존 폴링 파이프라인을 그대로 호출한다(재구현 없음). 아직 PUBG 서버에 안
// 올라왔으면(너무 빨리 누름) scrimsFound: 0 이 정상 응답이다 — 에러 아니다.
export async function POST(request: Request) {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PUBG_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;

  try {
    const supabase = getSupabaseServer();

    // rosterId가 있으면 이번 내전 참가자가 이미 확정돼 있다(01/02/03을 거침) —
    // 후보 30명을 훑는 대신 1번팀 1티어 한 명만 고정 씨앗으로 써서 API 호출을
    // 줄인다. 팀 배정은 02에서 나서야 정해지므로 이 사람이 누군지는 03 시트에
    // 들어오기 전까진 알 수 없다 — 그래서 매번 이 자리에서 다시 조회한다.
    // 그 자리가 비었거나(수동 추가한 사람이라 member_id가 없다든지) PUBG 계정이
    // 없으면 아예 못 찾은 채로 넘어가고, runPolling이 기존 방식으로 대체한다.
    let knownAccountId: string | null = null;
    if (rosterId) {
      const { data: entryRow } = await supabase
        .from('scrim_roster_entries')
        .select('members(member_pubg_accounts(pubg_account_id))')
        .eq('roster_id', rosterId)
        .eq('team_number', 1)
        .eq('tier_slot', 1)
        .not('member_id', 'is', null)
        .maybeSingle();

      const members = entryRow?.members as unknown as
        | { member_pubg_accounts: { pubg_account_id: string | null }[] }
        | null;
      knownAccountId = members?.member_pubg_accounts.find((a) => a.pubg_account_id)?.pubg_account_id ?? null;
    }

    const result = await runPolling({
      supabase,
      apiKey,
      sinceHours: 3,
      maxMatches: 50,
      playerRetries: 2,
      knownAccountId,
    });
    return NextResponse.json({ found: result.scrimsFound > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
