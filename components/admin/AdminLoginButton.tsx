'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAdmin } from './AdminProvider';

const CODE_LENGTH = 6;

export function AdminLoginButton() {
  const { isAdmin, login } = useAdmin();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 팝오버 바깥을 클릭하면 닫는다 — AccessGate는 전체 화면을 가려서 이 문제가
  // 없었지만, 여긴 작은 드롭다운이라 바깥 클릭 처리가 필요하다.
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
          if (isAdmin) return;
          setOpen((current) => !current);
        }}
        title={isAdmin ? '관리자로 로그인됨' : '관리자 로그인'}
        aria-label={isAdmin ? '관리자로 로그인됨' : '관리자 로그인'}
        className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
          isAdmin ? 'bg-accent/20 text-accent' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        🔑
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
