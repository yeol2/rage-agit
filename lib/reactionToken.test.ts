import { beforeAll, describe, expect, it } from 'vitest';
import { checkRunToken, issueRunToken } from './reactionToken';

const times = [240, 260, 230, 280, 250];

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('run token', () => {
  it('accepts a real run that took long enough', () => {
    const token = issueRunToken(0);
    expect(checkRunToken(token, times, 15_000)).toBeNull();
  });

  it('rejects a missing or forged token', () => {
    expect(checkRunToken(undefined, times, 15_000)).not.toBeNull();
    const [payload] = issueRunToken(0).split('.');
    expect(checkRunToken(`${payload}.forged`, times, 15_000)).not.toBeNull();
  });

  it('rejects a run finished faster than five rounds can take', () => {
    expect(checkRunToken(issueRunToken(0), times, 3_000)).toMatch(/진행 시간/);
  });

  it('rejects a token older than 30 minutes', () => {
    expect(checkRunToken(issueRunToken(0), times, 31 * 60 * 1000)).toMatch(/오래된/);
  });
});
