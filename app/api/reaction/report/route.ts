import { NextResponse } from 'next/server';
import { isValidRun, suspiciousReason } from '@/lib/reaction';
import { checkRunToken } from '@/lib/reactionToken';
import { fetchReactionRanking } from '@/lib/reactionData';
import { formatRunAlert, notifyAdmin, runAlertReasons } from '@/lib/reactionAlert';

// 판이 끝날 때마다 브라우저가 결과를 보낸다(등록 버튼과 상관없이). 현재 1등보다 빠르거나 부정 규칙에
// 걸린 판이면 운영자 디스코드로 알린다(lib/reactionAlert). 아무것도 저장하지 않는다.
// 알림 폭탄을 막으려고 시작 도장(토큰)이 정상이고 실제 진행 시간이 맞는 판만 받는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const times = body?.times;
  if (!isValidRun(times)) return NextResponse.json({ ok: true });
  if (checkRunToken(body.token, times)) return NextResponse.json({ ok: true });

  const ranking = await fetchReactionRanking().catch(() => null);
  if (!ranking) return NextResponse.json({ ok: true });
  const reasons = runAlertReasons(times, ranking[0]?.bestAvgMs ?? null, suspiciousReason(times));
  if (reasons.length === 0) return NextResponse.json({ ok: true });

  const savedNickname = typeof body.nickname === 'string' && body.nickname.trim() ? body.nickname.trim().slice(0, 40) : null;
  const tryNumber = Number.isInteger(body.tryNumber) && body.tryNumber > 0 ? (body.tryNumber as number) : null;
  const mistakes = Number.isInteger(body.mistakes) && body.mistakes >= 0 ? (body.mistakes as number) : null;
  await notifyAdmin(formatRunAlert({ times, reasons, savedNickname, tryNumber, mistakes }));
  return NextResponse.json({ ok: true });
}
