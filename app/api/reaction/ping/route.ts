import { NextResponse } from 'next/server';
import { getReactionSupabase } from '@/lib/reactionData';
import { readRunTokenId } from '@/lib/reactionToken';
import { isValidNonce } from '@/lib/reactionRounds';

// 회차 신호. 초록불이 켜질 때 { kind: 'green' }, 클릭할 때 { kind: 'click' } 를 같은 nonce 로 보낸다.
// 시각은 요청이 도착한 순간 서버가 찍는다(DB 쓰기에 걸리는 시간은 간격에 안 들어간다).
// 서명이 맞는 시작 도장(토큰)이 있어야 받는다. 응답은 기다릴 필요 없다(게임은 응답과 상관없이 진행).
export async function POST(request: Request) {
  const arrivedAt = new Date().toISOString();
  const body = await request.json().catch(() => null);
  const runId = readRunTokenId(body?.token);
  const kind = body?.kind;
  if (!runId || !isValidNonce(body?.nonce) || (kind !== 'green' && kind !== 'click')) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = getReactionSupabase();
  if (kind === 'green') {
    // 같은 nonce 의 green 은 처음 한 번만 — 나중에 다시 보내 시각을 늦추는 장난을 막는다.
    await supabase
      .from('reaction_round_pings')
      .upsert({ nonce: body.nonce, run_id: runId, green_at: arrivedAt }, { onConflict: 'nonce', ignoreDuplicates: true });
  } else {
    // click 은 green 이 이미 적힌 같은 판의 회차에만, 처음 한 번만.
    await supabase
      .from('reaction_round_pings')
      .update({ click_at: arrivedAt })
      .eq('nonce', body.nonce)
      .eq('run_id', runId)
      .is('click_at', null);
  }
  return NextResponse.json({ ok: true });
}
