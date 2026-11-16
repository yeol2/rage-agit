import { NextResponse } from 'next/server';
import { issueRunToken } from '@/lib/reactionToken';

// 반응속도 한 판 시작 — 서명된 시작 토큰을 준다(lib/reactionToken.ts).
export async function POST() {
  return NextResponse.json({ token: issueRunToken() });
}
