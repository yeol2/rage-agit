'use client';

import { useAdmin } from './AdminProvider';

// Nav 바로 아래, 모든 페이지 공통으로 뜬다 — 관리자로 로그인돼 있다는 걸
// 계속 상기시켜서 "왜 이 페이지는 편집이 되지?"를 헷갈리지 않게 한다.
export function AdminStatusBanner() {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-shell px-5 sm:px-8">
      <div
        className="rounded-lg border px-4 py-2.5 text-center text-sm font-bold"
        style={{ borderColor: '#0F4539', backgroundColor: '#0E1319', color: '#0F4539' }}
      >
        🔑 관리자로 로그인되어 있습니다
      </div>
    </div>
  );
}
