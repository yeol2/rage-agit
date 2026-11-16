'use client';

import { useEffect, useRef, useState } from 'react';

// 랭킹 줄 맨 오른쪽 드롭다운 — 그 사람 최고 기록 판의 5회 회차 기록(2026-11-16 사용자 요청).
// 마우스가 있는 기기는 올리면 펼쳐지고([@media(hover:hover)]), 폰은 눌러서 펼친다. 바깥을 누르면 접힌다.
// 패널은 늘 DOM 에 두고 invisible 로 숨긴다(메뉴바 놀이터 드롭다운과 같은 방식).
export function RoundTimesDropdown({ name, times }: { name: string; times: number[] | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const best = times ? Math.min(...times) : null;

  return (
    <div ref={ref} className="group relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`${name} 5회 기록 보기`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-5 items-center justify-center rounded-md sm:w-7 text-menu transition-colors hover:bg-white/10 hover:text-foreground"
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 transition-transform duration-200 [@media(hover:hover)]:group-hover:rotate-180 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* pt-2 — 버튼에서 패널로 마우스가 내려가는 동안 호버가 끊기지 않게. */}
      <div
        className={`absolute right-0 top-full z-20 pt-2 transition-all duration-150 ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0 [@media(hover:hover)]:group-hover:visible [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100'
        }`}
      >
        <div className="rounded-xl border border-white/[0.08] bg-[#1B1B23] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          <p className="mb-2 whitespace-nowrap text-[11px] text-menu">{name} · 5회 기록</p>
          {times ? (
            <ul className="flex gap-1.5">
              {times.map((t, i) => (
                <li
                  key={i}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs tabular-nums ${
                    t === best ? 'bg-accent/15 font-bold text-accent' : 'bg-white/[0.06] text-menu'
                  }`}
                >
                  {t}ms
                </li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-nowrap text-xs text-subtext">회차 기록 없음 — 다음에 기록을 깨면 보여요</p>
          )}
        </div>
      </div>
    </div>
  );
}
