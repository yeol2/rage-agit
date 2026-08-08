import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';
import pkg from '@/package.json';

const { footer, siteName } = siteConfig;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between md:gap-16">
          <div className="max-w-md">
            <p className="text-[15px] font-bold text-foreground">{siteName}</p>
            <p className="mt-4 text-sm leading-relaxed text-white/40">
              {footer.description}{' '}
              <span className="text-accent-secondary">{footer.descriptionAccent}</span>
            </p>
            <p className="mt-4 text-[13px] text-white/25">{footer.credit}</p>
          </div>

          <nav aria-label="푸터 메뉴" className="flex flex-col gap-3">
            {footer.links.map((link) =>
              link.ready ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-white/35 transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ) : (
                <span
                  key={link.label}
                  aria-disabled="true"
                  className="cursor-not-allowed text-sm text-white/35"
                >
                  {link.label}
                  <span className="sr-only"> (준비 중)</span>
                </span>
              )
            )}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-2 text-[13px] text-white/20 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteName} — {footer.tagline}
          </p>
          <p className="hud text-xs">VERSION {pkg.version}</p>
        </div>
      </div>
    </footer>
  );
}
