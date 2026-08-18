'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="w-full">
      {/* 원본 Frame 24: 카드 전체폭 / 높이 82.42 / 좌우 패딩 82.42.
          로고는 왼쪽, 메뉴는 항상 화면 중앙에 오도록 좌우를 대칭 1fr 로 잡는다. */}
      <div className="mx-auto grid max-w-shell grid-cols-[1fr_auto_1fr] items-center gap-x-6 gap-y-3 px-5 py-4 sm:h-[67px] sm:px-[67px] sm:py-0">
        <Link href="/" className="flex items-center gap-3 justify-self-start">
          <Logo />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight text-white sm:text-xl">
            {siteConfig.siteName}
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="col-start-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-2"
        >
          {siteConfig.nav.map((item) => {
            const active = item.ready && pathname === item.href;
            return item.ready ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // 👉 활성 메뉴 배경색은 여기(bg-white/10).
                className={`rounded-lg px-4 py-2 text-[15px] font-bold tracking-tight transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="hud cursor-not-allowed px-4 py-2 text-[15px] text-white/40"
              >
                {item.label}
                <span className="sr-only"> (준비 중)</span>
              </span>
            );
          })}
        </nav>

        <span aria-hidden="true" className="hidden justify-self-end sm:block" />
      </div>
    </header>
  );
}
