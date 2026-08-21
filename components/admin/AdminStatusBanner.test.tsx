import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminProvider } from './AdminProvider';
import { AdminStatusBanner } from './AdminStatusBanner';

vi.mock('@/components/admin/AdminProvider', async (importOriginal) => importOriginal());

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('AdminStatusBanner', () => {
  it('관리자가 아니면 아무것도 안 그린다', () => {
    const { container } = render(
      <AdminProvider>
        <AdminStatusBanner />
      </AdminProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('관리자면 로그인 상태 배너를 보여준다', () => {
    window.localStorage.setItem('rage-admin-unlocked', 'true');
    render(
      <AdminProvider>
        <AdminStatusBanner />
      </AdminProvider>,
    );
    expect(screen.getByText(/관리자로 로그인되어 있습니다/)).toBeInTheDocument();
  });
});
