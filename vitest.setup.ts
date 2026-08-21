import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

// Nav 가 usePathname() 으로 현재 메뉴를 강조 표시하는데, 앱 라우터 컨텍스트 없이
// render() 하는 테스트에서는 next/navigation 훅이 invariant 에러를 던진다.
// 테스트에서 특정 경로를 확인해야 하면 이 목을 파일별로 다시 vi.mock 하면 된다.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

// Nav가 이제 AdminLoginButton(useAdmin)을 렌더해서, Nav를 그리는 모든 테스트가
// AdminProvider 없이 렌더된다. 기본값은 "관리자 아님" — useAdmin이 vi.fn()이라
// 한 테스트에서만 관리자 상태를 보고 싶으면
// vi.mocked(useAdmin).mockReturnValueOnce({ isAdmin: true, login: vi.fn(), logout: vi.fn() })
// 처럼 그 테스트에서만 덮어쓰면 된다. Provider/버튼 자체의 진짜 동작을
// 검증해야 하면 파일 맨 위에
// vi.mock('@/components/admin/AdminProvider', async (importOriginal) => importOriginal())
// 를 다시 써서 이 목 전체를 되돌리면 된다.
vi.mock('@/components/admin/AdminProvider', () => ({
  AdminProvider: ({ children }: { children: ReactNode }) => children,
  useAdmin: vi.fn(() => ({ isAdmin: false, login: vi.fn(() => false), logout: vi.fn() })),
}));
