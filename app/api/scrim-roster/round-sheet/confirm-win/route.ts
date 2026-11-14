import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { confirmScrimWin } from '@/lib/scrimConfirm';

/**
 * 03 내전 시트의 "우승 확정" 버튼. 본체는 lib/scrimConfirm 이고 목·일 자동
 * 확정 크론과 같이 쓴다 — 무엇을 왜 저장하는지는 거기 적혀 있다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scrimDate = typeof body.scrimDate === 'string' ? body.scrimDate : null;
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId : null;
  if (!scrimDate) {
    return NextResponse.json({ error: 'scrimDate 가 필요합니다.' }, { status: 400 });
  }

  // 03 시트의 저티어 토글이 "우승 확정"을 누르는 순간 켜져 있었는지를 그대로 쓴다.
  // 값이 안 오면 일반 내전으로 본다.
  const result = await confirmScrimWin(getSupabaseServer(), {
    scrimDate,
    rosterId,
    lowTier: body.lowTier === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    scrimDate: result.scrimDate,
    teamNumber: result.teamNumber,
    totalScore: result.totalScore,
    players: result.players,
    lowTier: result.lowTier,
    savedTeams: result.savedTeams,
    savedMembers: result.savedMembers,
  });
}
