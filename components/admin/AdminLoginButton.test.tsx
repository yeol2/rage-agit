import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminProvider } from './AdminProvider';
import { AdminLoginButton } from './AdminLoginButton';

vi.mock('@/components/admin/AdminProvider', async (importOriginal) => importOriginal());

const STORAGE_KEY = 'rage-admin-unlocked';

beforeEach(() => {
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_CLAN_PASSPHRASE = 'RAGE01';
});

afterEach(cleanup);

function renderButton() {
  return render(
    <AdminProvider>
      <AdminLoginButton />
    </AdminProvider>,
  );
}

describe('AdminLoginButton', () => {
  it('평소엔 암구호 입력칸이 안 보인다', () => {
    renderButton();
    expect(screen.queryByLabelText(/관리자 암구호/)).not.toBeInTheDocument();
  });

  it('열쇠 버튼을 누르면 6칸 입력칸이 뜬다', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: '관리자 로그인' }));
    expect(screen.getAllByLabelText(/관리자 암구호 \d+번째/)).toHaveLength(6);
  });

  it('맞는 암구호를 다 입력하면 잠금이 풀리고 입력칸이 닫힌다', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: '관리자 로그인' }));
    const inputs = screen.getAllByLabelText(/관리자 암구호 \d+번째/);
    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], 'RAGE01'[i]);
    }
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(screen.queryByLabelText(/관리자 암구호/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '관리자 로그아웃' })).toBeInTheDocument();
  });

  it('틀린 암구호면 오류를 보이고 다시 입력하게 비운다', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: '관리자 로그인' }));
    const inputs = screen.getAllByLabelText(/관리자 암구호 \d+번째/);
    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], 'WRONG1'[i]);
    }
    expect(screen.getByText('암구호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe('true');
  });

  it('이미 관리자일 때 버튼을 누르면 로그아웃되고(입력칸은 안 뜸) 로컬스토리지도 지운다', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: '관리자 로그아웃' }));
    expect(screen.queryByLabelText(/관리자 암구호/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: '관리자 로그인' })).toBeInTheDocument();
  });
});
