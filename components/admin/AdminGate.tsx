'use client';

import type { ReactNode } from 'react';
import { useAdmin } from './AdminProvider';

// AccessGate(클랜원 페이지)와 다르다 — 여기는 안 가리고 그대로 다 보여주되,
// 관리자가 아니면 pointer-events-none으로 클릭·드래그만 막는다("보기는 누구나,
// 삭제/이동/변경은 관리자만"). 링크·버튼 구분해서 하나하나 잠그는 대신 감싸는
// 쪽이 훨씬 안전하다 — 새 버튼이 생겨도 따로 안 챙겨도 자동으로 막힌다.
export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin } = useAdmin();

  return (
    <div>
      {!isAdmin && (
        <p className="mb-4 text-xs text-menu">
          보기 전용입니다 — 편집하려면 우측 상단 🔑로 관리자 로그인하세요.
        </p>
      )}
      <div className={isAdmin ? undefined : 'pointer-events-none select-none'}>{children}</div>
    </div>
  );
}
