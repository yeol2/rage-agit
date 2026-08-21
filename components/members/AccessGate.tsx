'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

const STORAGE_KEY = 'rage-members-unlocked';
const CODE_LENGTH = 6;

export function AccessGate({ children }: { children: ReactNode }) {
  // 로컬스토리지는 브라우저에만 있다 — 서버 렌더 결과와 클라이언트 첫 렌더가
  // 어긋나면 하이드레이션 경고가 난다. 그래서 마운트 후에만 실제 상태를 정한다.
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === 'true');
    setChecked(true);
  }, []);

  function attempt(code: string) {
    const passphrase = process.env.NEXT_PUBLIC_CLAN_PASSPHRASE;
    if (!passphrase) {
      setError('암구호가 설정되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }
    if (code === passphrase) {
      window.localStorage.setItem(STORAGE_KEY, 'true');
      setUnlocked(true);
      setError(null);
      return;
    }
    setError('암구호가 올바르지 않습니다.');
    setDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
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
      attempt(next.join(''));
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  if (!checked) return null;

  return (
    <div className="relative">
      <div
        className={unlocked ? '' : 'pointer-events-none select-none blur-md'}
        aria-hidden={!unlocked}
      >
        {children}
      </div>
      {!unlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4">
          <div className="clip-corner w-full max-w-sm border border-white/10 bg-background px-8 py-10 text-center">
            <h2 className="text-xl font-bold text-foreground">Rage 클랜원을 인증하세요</h2>
            <p className="mt-2 text-sm text-menu">알맞는 비밀번호를 입력해야 이용 할 수 있습니다</p>
            <div className="mt-6 flex justify-center gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="password"
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  autoFocus={index === 0}
                  maxLength={1}
                  aria-label={`암구호 ${index + 1}번째 글자`}
                  className="h-12 w-10 rounded-md border border-white/15 bg-white/[0.03] text-center text-lg text-foreground outline-none focus:border-accent"
                />
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
