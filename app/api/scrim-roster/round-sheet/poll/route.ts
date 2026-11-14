import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { pollScrim } from '@/lib/scrimPoll';

// 03 내전 시트의 "폴링" 버튼 — 방금 끝난 매치를 잡으러 기존 폴링 파이프라인을
// 그대로 호출한다. 본체는 lib/scrimPoll 이고 목·일 자동 폴링 크론과 같이 쓴다.
// 아직 PUBG 서버에 안 올라왔으면(너무 빨리 누름) found: false 가 정상 응답이다.
export async function POST(request: Request) {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PUBG_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;
  // 버튼을 누른 시각과 몇 번째 시도인지는 클라이언트만 안다 — 한 번 눌러두면
  // 매치가 잡힐 때까지 이 라우트를 여러 번 두드리기 때문이다.
  const pressedAt = typeof body.pressedAt === 'string' ? body.pressedAt : null;
  const attempt = typeof body.attempt === 'number' ? body.attempt : 1;

  try {
    const result = await pollScrim(getSupabaseServer(), { apiKey, rosterId, pressedAt, attempt });
    return NextResponse.json({ found: result.found });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
