import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';
import { LocalClock } from './LocalClock';

export function Nav() {
  return (
    <header className="w-full border-b border-white/5">
      <div className="mx-auto grid max-w-shell grid-cols-2 items-center gap-x-6 gap-y-4 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hud whitespace-nowrap text-lg font-bold text-foreground sm:text-xl">
            {siteConfig.siteName}
          </span>
        </div>

        <nav
          aria-label="주요 메뉴"
          className="order-last col-span-2 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 lg:order-none lg:col-span-1"
        >
          {siteConfig.nav.map((item) => (
            <span
              key={item.label}
              aria-disabled="true"
              className="hud cursor-not-allowed text-[15px] text-menu transition-colors hover:text-foreground"
            >
              {item.label}
              <span className="sr-only"> (준비 중)</span>
            </span>
          ))}
        </nav>

        <div className="flex justify-end">
          <div className="clip-corner border border-white/10 bg-white/[0.03] px-5 py-2.5 pt-2">
            <div className="hud text-[11px] text-menu/70">LOCAL TIME</div>
            <div className="hud mt-0.5 text-[15px]">
              <LocalClock />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
