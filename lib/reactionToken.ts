import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { REACTION_ROUNDS, WAIT_MIN_MS } from '@/lib/reaction';

// 서버 전용. 반응속도 한 판의 "시작 도장"(①).
// START 때 서버가 시각을 찍어 서명한 토큰을 주고, 등록할 때 돌려받는다. 그래서
//   - 게임을 안 하고 기록만 바로 보내는 것(토큰 없음/위조)을 막고
//   - 시작부터 등록까지 걸린 시간이 실제로 5회를 할 수 있는 최소 시간보다 짧으면 거절한다.
// 반응 시간 자체는 브라우저가 재는 값이라 이것만으로 완벽하진 않다 — ③(lib/reaction.ts)과 같이 쓴다.
// 서명 키는 이미 서버에만 있는 service role 키에서 파생한다(새 환경변수 없이).

const MAX_AGE_MS = 30 * 60 * 1000;

function key(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 필요합니다');
  return `reaction-run:${secret}`;
}

function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url');
}

export function issueRunToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: randomUUID(), t: now })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** 통과면 null, 아니면 사용자에게 보여줄 이유. */
export function checkRunToken(token: unknown, times: number[], now = Date.now()): string | null {
  if (typeof token !== 'string' || !token.includes('.')) return '게임을 처음부터 다시 진행해주세요.';
  const [payload, signature] = token.split('.');
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature ?? '');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return '게임을 처음부터 다시 진행해주세요.';
  }

  let startedAt: number;
  try {
    startedAt = Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).t);
  } catch {
    return '게임을 처음부터 다시 진행해주세요.';
  }

  const elapsed = now - startedAt;
  if (!(elapsed >= 0) || elapsed > MAX_AGE_MS) return '너무 오래된 기록이에요. 한 판 더 해주세요.';
  // 5회 모두 빨간불 최소 대기 + 실제 반응 시간만큼은 흘렀어야 한다.
  const minimum = REACTION_ROUNDS * WAIT_MIN_MS + times.reduce((sum, t) => sum + t, 0);
  if (elapsed < minimum) return '기록이 진행 시간과 맞지 않아요. 다시 도전해주세요.';
  return null;
}
