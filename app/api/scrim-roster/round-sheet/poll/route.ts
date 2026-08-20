import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { runPolling } from '@/supabase/functions/_shared/polling.mjs';

// 03 내전 시트의 "폴링" 버튼 — 방금 끝난 매치 하나를 잡으러 짧은 시간창으로
// 기존 폴링 파이프라인을 그대로 호출한다(재구현 없음). 아직 PUBG 서버에 안
// 올라왔으면(너무 빨리 누름) scrimsFound: 0 이 정상 응답이다 — 에러 아니다.
export async function POST() {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PUBG_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const result = await runPolling({
      supabase: getSupabaseServer(),
      apiKey,
      sinceHours: 3,
      maxMatches: 50,
      playerRetries: 2,
    });
    return NextResponse.json({ found: result.scrimsFound > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
