'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';
import { AdminLoginButton } from './admin/AdminLoginButton';
import { AdminStatusBanner } from './admin/AdminStatusBanner';

const MENU_ITEM = 'rounded-lg px-5 py-2.5 text-base font-bold tracking-tight transition-colors';

// 놀이터 — 마우스를 올리면 펼쳐지고 그 안에서 골라야 이동한다. 휴대폰(호버 없음)은
// 눌러서 펼친다. 펼침은 CSS(group-hover / focus-within)와 open 상태 둘 중 하나만 맞아도 된다.
// 호버 펼침은 진짜 마우스가 있는 기기에서만([@media(hover:hover)]) — 폰은 탭하면 :hover 가 붙은 채
// 남아서, 바깥을 눌러 open 을 꺼도 메뉴가 안 닫힐 수 있다.
// 메뉴 패널은 늘 DOM 에 두고 invisible 로 숨긴다 — 숨긴 동안엔 탭 포커스도 안 간다.
function PlaygroundMenu({ pathname }: { pathname: string }) {
  const { label, items } = siteConfig.playground;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  // 다른 페이지로 넘어가면 접는다.
  useEffect(() => setOpen(false), [pathname]);

  // 바깥을 누르면 접는다(휴대폰에서 눌러 펼친 경우).
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div
      ref={ref}
      className="group relative"
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${MENU_ITEM} inline-flex items-center gap-1.5 ${
          active ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white group-hover:text-white'
        }`}
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform duration-200 [@media(hover:hover)]:group-hover:rotate-180 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* pt-2 는 버튼과 패널 사이 틈 — 마우스가 내려가는 동안 호버가 끊기지 않게 패널 쪽에 붙인다. */}
      <div
        className={`absolute right-0 top-full z-10 pt-2 transition-all duration-150 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:visible [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100'
        }`}
      >
        <ul className="w-56 rounded-xl border border-white/[0.08] bg-[#1B1B23] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          {items.map((item) => {
            const current = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={`flex flex-col rounded-lg px-3.5 py-2.5 transition-colors ${
                    current ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`text-sm font-bold ${current ? 'text-accent' : 'text-white'}`}>{item.label}</span>
                  {item.hint && <span className="mt-0.5 text-xs text-menu">{item.hint}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname() ?? '';

  return (
    // relative + z-[60] — 원래는 클랜원 페이지 인증 팝업(AccessGate)의 전체화면
    // 블러(z-50)에 메뉴바까지 덮이는 걸 막으려던 것이다. 그 잠금은 없앴지만,
    // 메뉴바는 어떤 오버레이보다도 위에 있어야 나갈 길이 막히지 않으므로 그대로 둔다.
    <header className="relative z-[60] w-full space-y-3 bg-background">
      {/* 좌우 패딩은 본문 섹션(max-w-shell px-5 sm:px-8)과 반드시 맞춘다 — 로고/메뉴가
          아래 본문 텍스트와 세로로 일직선이 되어야 한다. 높이는 본문보다 눈에 띄게
          크게 잡아 메뉴바를 더 존재감 있게 만든다. */}
      <div className="mx-auto grid max-w-shell grid-cols-[1fr_auto_1fr] items-center gap-x-6 gap-y-3 px-5 py-5 sm:h-[96px] sm:px-8 sm:py-0">
        <Link href="/" className="flex items-center gap-3 justify-self-start">
          <Logo size={34} />
          <span className="whitespace-nowrap text-xl font-bold tracking-tight text-white sm:text-2xl">
            {siteConfig.siteName}
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="col-start-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-2"
        >
          {siteConfig.nav.map((item) => {
            const active = item.ready && pathname === item.href;
            return item.ready ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // 내전(/team-builder)은 접속마다 새로 그리는 페이지라, 미리 불러오기(prefetch)를 켜두면 메뉴바가
                // 보이는 모든 화면에서 서버를 깨운다 — 무료 CPU 한도를 넘긴 뒤 껐다(2026-11-19). 누를 때만 불러온다.
                prefetch={item.href === '/team-builder' ? false : undefined}
                // 👉 활성 메뉴 배경색은 여기(bg-white/10).
                className={`${MENU_ITEM} ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'}`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="hud cursor-not-allowed px-5 py-2.5 text-base text-white/40"
              >
                {item.label}
                <span className="sr-only"> (준비 중)</span>
              </span>
            );
          })}
          <PlaygroundMenu pathname={pathname} />
        </nav>

        <div className="justify-self-end">
          <AdminLoginButton />
        </div>
      </div>

      <AdminStatusBanner />
    </header>
  );
}
