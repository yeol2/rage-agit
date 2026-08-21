'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'rage-admin-unlocked';

interface AdminContextValue {
  // 마운트 전(SSR)에는 로컬스토리지를 못 읽으므로 false로 시작한다 —
  // AccessGate와 같은 이유로 하이드레이션 경고를 피한다.
  isAdmin: boolean;
  login: (code: string) => boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(window.localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  function login(code: string): boolean {
    const passphrase = process.env.NEXT_PUBLIC_CLAN_PASSPHRASE;
    if (!passphrase || code !== passphrase) return false;
    window.localStorage.setItem(STORAGE_KEY, 'true');
    setIsAdmin(true);
    return true;
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }

  return <AdminContext.Provider value={{ isAdmin, login, logout }}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin은 AdminProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
