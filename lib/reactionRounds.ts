import { REACTION_ROUNDS } from '@/lib/reaction';

// 반응속도 — 회차마다 서버 확인(2026-11-17, "게임 없이 숫자만 보내기" 막기).
// 초록불이 켜질 때 'green', 클릭할 때 'click' 신호가 서버에 도착한 시각(reaction_round_pings)으로
// 회차 간격을 서버가 직접 잰다. 브라우저가 보고한 반응 시간이 그보다 SLACK_MS 넘게 짧으면 거짓으로 본다.
//
// 네트워크가 흔들려 한두 회차는 어긋날 수 있어서(콜드 스타트·모바일 지연), 5회 중 MAX_BAD_ROUNDS 회까지는
// 봐준다. 숫자만 지어내서 보내면 신호 자체가 없거나 5회 모두 어긋나 걸린다.

export const SLACK_MS = 100;
export const MAX_BAD_ROUNDS = 2;

export interface RoundPing {
  nonce: string;
  run_id: string;
  green_at: string | null;
  click_at: string | null;
}

/** 회차 번호(nonce)로 쓸 수 있는 문자열인지. 브라우저가 crypto.randomUUID() 로 만든다. */
export function isValidNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(value);
}

/**
 * 통과면 null, 아니면 사용자에게 보여줄 이유.
 * times[i] 는 nonces[i] 회차의 기록이다. 신호가 없거나 다른 판의 신호면 바로 거절, 시간이 어긋난 회차가
 * MAX_BAD_ROUNDS 를 넘으면 거절한다.
 */
export function checkRoundPings(runId: string, times: number[], nonces: unknown, pings: RoundPing[]): string | null {
  if (!Array.isArray(nonces) || nonces.length !== REACTION_ROUNDS || !nonces.every(isValidNonce)) {
    return '회차 확인 기록이 없어요. 처음부터 다시 해주세요.';
  }
  if (new Set(nonces).size !== REACTION_ROUNDS) return '회차 확인 기록이 이상해요. 처음부터 다시 해주세요.';

  const byNonce = new Map(pings.map((p) => [p.nonce, p]));
  let bad = 0;
  for (let i = 0; i < REACTION_ROUNDS; i++) {
    const ping = byNonce.get(nonces[i] as string);
    if (!ping || ping.run_id !== runId || !ping.green_at || !ping.click_at) {
      return '회차 확인 기록이 없어요. 인터넷이 불안정했을 수 있어요 — 처음부터 다시 해주세요.';
    }
    const serverMs = Date.parse(ping.click_at) - Date.parse(ping.green_at);
    if (!(serverMs >= 0) || times[i] < serverMs - SLACK_MS) bad++;
  }
  if (bad > MAX_BAD_ROUNDS) return '기록이 서버에서 잰 시간과 맞지 않아요. 다시 도전해주세요.';
  return null;
}
