import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { AdminProvider, useAdmin } from './AdminProvider';

// 이 파일은 진짜 구현을 검증해야 하므로, vitest.setup.ts의 전역 목을 되돌린다.
vi.mock('@/components/admin/AdminProvider', async (importOriginal) => importOriginal());

const STORAGE_KEY = 'rage-admin-unlocked';

function Probe() {
  const { isAdmin, login, logout } = useAdmin();
  return (
    <div>
      <p>{isAdmin ? '관리자' : '일반'}</p>
      <button onClick={() => login('RAGE01')}>로그인 시도</button>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_CLAN_PASSPHRASE = 'RAGE01';
});

afterEach(cleanup);

describe('AdminProvider', () => {
  it('기본값은 관리자 아님이다', () => {
    render(
      <AdminProvider>
        <Probe />
      </AdminProvider>,
    );
    expect(screen.getByText('일반')).toBeInTheDocument();
  });

  it('맞는 암구호로 login()하면 관리자가 되고 로컬스토리지에 기억한다', async () => {
    render(
      <AdminProvider>
        <Probe />
      </AdminProvider>,
    );
    await act(async () => {
      screen.getByText('로그인 시도').click();
    });
    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('이미 이 브라우저에서 풀었으면 마운트하자마자 관리자로 시작한다', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    render(
      <AdminProvider>
        <Probe />
      </AdminProvider>,
    );
    expect(screen.getByText('관리자')).toBeInTheDocument();
  });

  it('logout()하면 관리자에서 빠지고 로컬스토리지에서도 지운다', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    render(
      <AdminProvider>
        <Probe />
      </AdminProvider>,
    );
    expect(screen.getByText('관리자')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('로그아웃').click();
    });
    expect(screen.getByText('일반')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('useAdmin을 Provider 밖에서 쓰면 에러를 던진다', () => {
    // 콘솔에 에러 스택이 안 찍히도록 잠깐 막는다 — React가 렌더 에러를 로그한다.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAdmin은 AdminProvider 안에서만 쓸 수 있습니다.');
    spy.mockRestore();
  });
});
