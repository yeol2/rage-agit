import { average, MIN_AVG_MS, spread } from '@/lib/reaction';
import { sendDiscord } from '@/supabase/functions/_shared/notify.mjs';

// 서버 전용. 반응속도 — 운영자 디스코드(DISCORD_WEBHOOK_URL, 운영자 개인 채널)로 보내는 알림(2026-11-16 사용자 요청).
//   1) 판 결과: 등록을 안 눌러도, 현재 1등보다 빠르거나 부정 규칙에 걸린 판이면 알린다(/api/reaction/report).
//   2) 등록 실패: 비밀번호·명단·부정 검사 등으로 등록이 막히면 알린다(/api/reaction).
// "누가"는 브라우저에 저장된 닉네임 또는 입력한 닉네임뿐이다 — IP 같은 건 모으지 않는다.
// 알림은 곁다리라 실패해도 조용히 넘긴다. 폭탄을 막으려고 인스턴스당 1분에 MAX_PER_MINUTE 개까지만.

const MAX_PER_MINUTE = 20;
let windowStart = 0;
let sentInWindow = 0;

function allowed(now = Date.now()): boolean {
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_PER_MINUTE) return false;
  sentInWindow++;
  return true;
}

/** 디스코드 마크다운이 이름을 망가뜨리지 않게(Ez_Code 의 _ 등). */
function esc(text: string): string {
  return text.replace(/([_*~`|\\>])/g, '\\$1');
}

function kstNow(): string {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function describeTimes(times: number[]): string {
  return `평균 **${average(times)}ms** · 5회 ${times.join(' / ')} (편차 ${spread(times).toFixed(1)}ms)`;
}

/** 판 결과를 알려야 하는지 + 그 이유들. topAvgMs 는 지금 랭킹 1등 평균(없으면 null). */
export function runAlertReasons(times: number[], topAvgMs: number | null, suspicious: string | null): string[] {
  const reasons: string[] = [];
  const avg = average(times);
  if (topAvgMs !== null && avg < topAvgMs) reasons.push(`현재 1등(${topAvgMs}ms)보다 빠름`);
  if (topAvgMs === null) reasons.push('랭킹이 비어 있어 1등감');
  if (suspicious) reasons.push(avg < MIN_AVG_MS ? `평균 ${MIN_AVG_MS}ms 미만(등록 막힘)` : '매크로 의심 — 편차 4ms 미만(등록 막힘)');
  return reasons;
}

export function formatRunAlert(args: {
  times: number[];
  reasons: string[];
  savedNickname: string | null;
  tryNumber: number | null;
  mistakes: number | null;
}): string {
  return [
    '🏁 **반응속도 판 결과** (등록 여부와 상관없이)',
    `• 누가: ${args.savedNickname ? `${esc(args.savedNickname)} (이 브라우저에 저장된 닉네임)` : '알 수 없음 (등록한 적 없는 브라우저)'}`,
    `• 언제: ${kstNow()}`,
    `• ${describeTimes(args.times)}`,
    `• 판 수: ${args.tryNumber !== null ? `${args.tryNumber}번째 판` : '모름'} · 실수 ${args.mistakes ?? '?'}번`,
    `• 이유: ${args.reasons.join(', ')}`,
  ].join('\n');
}

export function formatRegisterFailAlert(args: {
  nickname: string;
  error: string;
  times: unknown;
  /** 부정 의심(숫자 지어내기·평균 125ms 미만·편차 4ms 미만)이면 제목을 따로 단다. */
  suspected?: boolean;
}): string {
  const times = Array.isArray(args.times) && args.times.length === 5 && args.times.every((t) => typeof t === 'number')
    ? describeTimes(args.times as number[])
    : `기록 형식 이상: ${esc(JSON.stringify(args.times ?? null).slice(0, 80))}`;
  return [
    args.suspected ? '🚨 **반응속도 부정 의심 — 등록 시도**' : '⚠️ **반응속도 등록 실패**',
    `• 입력한 닉네임: ${args.nickname ? esc(args.nickname) : '(빈칸)'}`,
    `• 언제: ${kstNow()}`,
    `• ${times}`,
    `• 실패 이유: ${args.error}`,
  ].join('\n');
}

export async function notifyAdmin(content: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !allowed()) return;
  try {
    await sendDiscord(webhookUrl, content);
  } catch {
    // 알림 실패는 조용히 넘긴다.
  }
}
