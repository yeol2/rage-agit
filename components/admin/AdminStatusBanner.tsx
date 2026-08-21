'use client';

import { useAdmin } from './AdminProvider';
import { KeyIcon } from './KeyIcon';

// Nav 바로 아래, 모든 페이지 공통으로 뜬다 — 관리자로 로그인돼 있다는 걸
// 계속 상기시켜서 "왜 이 페이지는 편집이 되지?"를 헷갈리지 않게 한다.
// 처음엔 글씨도 #0F4539로 배경과 거의 안 겹치게 잡았는데 너무 안 보여서,
// 테두리/배경은 같은 톤을 유지하되 밝기만 올리고 글씨는 흰색에 가깝게 뺐다.
export function AdminStatusBanner() {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;

  return (
    <div className="mx-auto flex max-w-shell justify-center px-5 sm:px-8">
      <div
        className="flex w-fit items-center justify-center gap-2 rounded-lg border px-6 py-4 text-center text-sm font-bold"
        style={{ borderColor: '#1FA37A', backgroundColor: '#132A24', color: '#EFFFFA' }}
      >
        <KeyIcon size={16} />
        관리자로 로그인되어 있습니다
      </div>
    </div>
  );
}
