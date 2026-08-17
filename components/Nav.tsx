import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';

export function Nav() {
  return (
    <header className="w-full">
      {/* 원본 Frame 24: 카드 전체폭 / 높이 82.42 / 좌우 패딩 82.42 / space-between */}
      <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:h-[67px] sm:px-[67px] sm:py-0">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {siteConfig.siteName}
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="flex flex-wrap items-center justify-end gap-x-7 gap-y-2"
        >
          {siteConfig.nav.map((item) =>
            item.ready ? (
              <Link
                key={item.label}
                href={item.href}
                className="text-[15px] font-bold tracking-tight text-menu transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="hud cursor-not-allowed text-[15px] text-menu transition-colors hover:text-foreground"
              >
                {item.label}
                <span className="sr-only"> (준비 중)</span>
              </span>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
