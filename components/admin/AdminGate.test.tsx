import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminProvider } from './AdminProvider';
import { AdminGate } from './AdminGate';

vi.mock('@/components/admin/AdminProvider', async (importOriginal) => importOriginal());

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('AdminGate', () => {
  it('관리자가 아니면 내용은 그대로 보이되 클릭이 안 먹도록 pointer-events-none을 건다', () => {
    render(
      <AdminProvider>
        <AdminGate>
          <button>삭제</button>
        </AdminGate>
      </AdminProvider>,
    );
    expect(screen.getByText('삭제')).toBeInTheDocument();
    expect(screen.getByText('삭제').parentElement).toHaveClass('pointer-events-none');
    expect(screen.getByText(/보기 전용입니다/)).toBeInTheDocument();
  });

  it('관리자면 pointer-events-none이 없고 안내 문구도 없다', () => {
    window.localStorage.setItem('rage-admin-unlocked', 'true');
    render(
      <AdminProvider>
        <AdminGate>
          <button>삭제</button>
        </AdminGate>
      </AdminProvider>,
    );
    expect(screen.getByText('삭제').parentElement).not.toHaveClass('pointer-events-none');
    expect(screen.queryByText(/보기 전용입니다/)).not.toBeInTheDocument();
  });
});
