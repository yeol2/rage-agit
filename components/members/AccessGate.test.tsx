import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessGate } from './AccessGate';

const STORAGE_KEY = 'rage-members-unlocked';

beforeEach(() => {
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_CLAN_PASSPHRASE = 'RAGE01';
});

afterEach(cleanup);

describe('AccessGate', () => {
  it('잠긴 상태에서는 안내 문구를 보여주고 내용은 블러 처리한다', () => {
    render(
      <AccessGate>
        <p>비밀 내용</p>
      </AccessGate>,
    );
    expect(screen.getByText('Rage 클랜원을 인증하세요')).toBeInTheDocument();
    expect(screen.getByText('비밀 내용').parentElement).toHaveClass('blur-md');
  });

  it('맞는 암구호를 6칸에 입력하면 잠금이 풀리고 기억한다', async () => {
    render(
      <AccessGate>
        <p>비밀 내용</p>
      </AccessGate>,
    );
    const inputs = screen.getAllByLabelText(/암구호 \d+번째/);
    expect(inputs).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], 'RAGE01'[i]);
    }
    expect(screen.queryByText('Rage 클랜원을 인증하세요')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('틀린 암구호면 오류를 보이고 다시 입력하게 비운다', async () => {
    render(
      <AccessGate>
        <p>비밀 내용</p>
      </AccessGate>,
    );
    const inputs = screen.getAllByLabelText(/암구호 \d+번째/);
    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], 'WRONG1'[i]);
    }
    expect(screen.getByText('암구호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.getByText('Rage 클랜원을 인증하세요')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe('true');
  });

  it('암구호가 설정 안 돼 있으면 맞는 값이 없다는 뜻이라 항상 오류를 보인다', async () => {
    delete process.env.NEXT_PUBLIC_CLAN_PASSPHRASE;
    render(
      <AccessGate>
        <p>비밀 내용</p>
      </AccessGate>,
    );
    const inputs = screen.getAllByLabelText(/암구호 \d+번째/);
    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], 'ANYVAL'[i]);
    }
    expect(screen.getByText('암구호가 설정되지 않았습니다. 관리자에게 문의하세요.')).toBeInTheDocument();
  });

  it('이미 이 브라우저에서 풀었으면 다시 안 물어본다', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    render(
      <AccessGate>
        <p>비밀 내용</p>
      </AccessGate>,
    );
    expect(screen.queryByText('Rage 클랜원을 인증하세요')).not.toBeInTheDocument();
    expect(screen.getByText('비밀 내용').parentElement).not.toHaveClass('blur-md');
  });
});
