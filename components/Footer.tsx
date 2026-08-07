import { siteConfig } from '@/lib/siteConfig';
import { Logo } from './Logo';
import pkg from '@/package.json';

export function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-3">
          <Logo size={20} />
          <span className="hud whitespace-nowrap text-[13px] text-menu">
            {siteConfig.siteName}
          </span>
        </div>

        <span className="hud text-xs text-menu/60">VERSION {pkg.version}</span>
      </div>
    </footer>
  );
}
