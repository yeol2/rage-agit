'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAdmin } from './AdminProvider';
import { KeyIcon } from './KeyIcon';

const CODE_LENGTH = 6;

export function AdminLoginButton() {
  const { isAdmin, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 팝오버 바깥을 클릭하면 닫는다 — 작은 드롭다운이라 바깥 클릭 처리가 필요하다.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function reset() {
    setDigits(Array(CODE_LENGTH).fill(''));
    setError(null);
  }

  function handleChange(index: number, raw: string) {
    const char = raw.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== '')) {
      const ok = login(next.join(''));
      if (ok) {
        setOpen(false);
        reset();
      } else {
        setError('암구호가 올바르지 않습니다.');
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div ref={containerRef} className="relative justify-self-end">
      <button
        type="button"
        onClick={() => {
          if (isAdmin) {
            logout();
            return;
          }
          setOpen((current) => !current);
        }}
        title={isAdmin ? '관리자 로그아웃' : '관리자 로그인'}
        aria-label={isAdmin ? '관리자 로그아웃' : '관리자 로그인'}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
      >
        {/* 눌린 버튼처럼 배경을 채우는 대신, 관리자일 때는 아이콘 자체가
            빛나는 느낌을 준다 — drop-shadow 는 배경색과 무관하게 아이콘
            윤곽을 따라 은은하게 퍼진다. */}
        <span className={isAdmin ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]' : undefined}>
          <KeyIcon />
        </span>
      </button>

      {open && !isAdmin && (
        <div className="clip-corner absolute right-0 top-full z-50 mt-2 w-64 border border-white/15 bg-background p-4 shadow-xl">
          <p className="text-xs text-menu">관리자 암구호를 입력하세요</p>
          <div className="mt-3 flex justify-center gap-1.5">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                type="password"
                autoFocus={index === 0}
                maxLength={1}
                aria-label={`관리자 암구호 ${index + 1}번째 글자`}
                className="h-10 w-8 rounded-md border border-white/15 bg-white/[0.03] text-center text-sm text-foreground outline-none focus:border-accent"
              />
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
