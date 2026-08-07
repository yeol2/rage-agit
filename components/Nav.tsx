import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';
import { LocalClock } from './LocalClock';

export function Nav() {
  return (
    <header className="w-full border-b border-white/5">
      <div className="mx-auto flex max-w-shell flex-wrap items-start justify-between gap-y-4 px-8 py-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hud text-sm font-medium text-foreground">{siteConfig.siteName}</span>
            <span className="hidden h-px w-14 bg-white/15 sm:block" />
            <span className="hud hidden text-[10px] text-white/35 sm:block">
              {siteConfig.protocol}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="hud text-[10px] text-white/35">{siteConfig.systemLine}</span>
          </div>
        </div>

        <nav aria-label="주요 메뉴" className="flex items-center gap-7 pt-1.5">
          {siteConfig.nav.map((item) => (
            <span
              key={item.label}
              aria-disabled="true"
              className="hud cursor-not-allowed text-[11px] text-white/25"
            >
              {item.label}
              <span className="sr-only"> (준비 중)</span>
            </span>
          ))}
        </nav>

        <div className="clip-corner border border-white/10 bg-white/[0.03] px-5 py-2.5 pt-2">
          <div className="hud text-[9px] text-white/30">LOCAL TIME</div>
          <div className="hud mt-0.5 text-sm">
            <LocalClock />
          </div>
        </div>
      </div>
    </header>
  );
}
