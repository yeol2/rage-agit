import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { captureRankingSnapshotForRoster } from '@/lib/rankingSnapshot';

// 03 폴링이 라운드 4개 도달을 감지했을 때 서버 내부에서 직접 호출하는
// 함수(captureRankingSnapshotForRoster)를 그대로 감싼 HTTP 진입점 — 수동
// 재실행·테스트용으로 별도 라우트도 열어둔다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;
  if (!rosterId) {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  try {
    const result = await captureRankingSnapshotForRoster(getSupabaseServer(), rosterId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '등수 스냅샷 캡처에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
