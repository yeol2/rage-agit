import { describe, expect, it } from 'vitest';
import { checkRoundPings, type RoundPing } from './reactionRounds';

const RUN = 'run-1';
const nonces = ['aaaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaaa3', 'aaaaaaaaaaaaaaaa4', 'aaaaaaaaaaaaaaaa5'];

/** 서버가 잰 간격(ms)들로 신호 줄을 만든다. */
function pingsFor(serverMs: number[], runId = RUN): RoundPing[] {
  return serverMs.map((ms, i) => {
    const green = Date.UTC(2026, 10, 17, 12, 0, i * 10);
    return {
      nonce: nonces[i],
      run_id: runId,
      green_at: new Date(green).toISOString(),
      click_at: new Date(green + ms).toISOString(),
    };
  });
}

describe('checkRoundPings', () => {
  it('passes an honest run (server intervals close to the reported times)', () => {
    const times = [241, 268, 225, 290, 252];
    expect(checkRoundPings(RUN, times, nonces, pingsFor([255, 280, 240, 300, 270]))).toBeNull();
  });

  it('rejects numbers sent without playing (no round signals)', () => {
    expect(checkRoundPings(RUN, [140, 145, 150, 138, 142], nonces, [])).toMatch(/회차 확인 기록이 없어요/);
    expect(checkRoundPings(RUN, [140, 145, 150, 138, 142], undefined, [])).toMatch(/회차 확인 기록이 없어요/);
  });

  it('rejects reported times much faster than what the server measured', () => {
    const times = [140, 145, 150, 138, 142];
    expect(checkRoundPings(RUN, times, nonces, pingsFor([420, 390, 450, 400, 410]))).toMatch(/서버에서 잰 시간과 맞지 않아요/);
  });

  it('forgives up to two rounds thrown off by network lag', () => {
    const times = [241, 268, 225, 290, 252];
    expect(checkRoundPings(RUN, times, nonces, pingsFor([600, 700, 240, 300, 270]))).toBeNull();
    expect(checkRoundPings(RUN, times, nonces, pingsFor([600, 700, 900, 300, 270]))).toMatch(/맞지 않아요/);
  });

  it('rejects signals that belong to another run', () => {
    const times = [241, 268, 225, 290, 252];
    expect(checkRoundPings(RUN, times, nonces, pingsFor([255, 280, 240, 300, 270], 'other-run'))).toMatch(/없어요/);
  });

  it('rejects the same round number used twice', () => {
    const times = [241, 268, 225, 290, 252];
    const dup = [nonces[0], nonces[0], nonces[2], nonces[3], nonces[4]];
    expect(checkRoundPings(RUN, times, dup, pingsFor([255, 280, 240, 300, 270]))).toMatch(/이상해요/);
  });
});
