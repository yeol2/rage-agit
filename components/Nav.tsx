'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';
import { AdminLoginButton } from './admin/AdminLoginButton';

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="w-full">
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
                // 👉 활성 메뉴 배경색은 여기(bg-white/10).
                className={`rounded-lg px-5 py-2.5 text-base font-bold tracking-tight transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
                }`}
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
        </nav>

        <div className="justify-self-end">
          <AdminLoginButton />
        </div>
      </div>
    </header>
  );
}
