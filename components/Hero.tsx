import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';

const { hero, members } = siteConfig;

export function Hero() {
  return (
    <section className="mx-auto max-w-shell px-5 py-20 sm:px-8 md:py-32">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{hero.eyebrow}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        <p className="hud hidden shrink-0 items-center gap-2 text-[11px] text-menu sm:flex sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-positive" />
          {hero.statusLabel}
        </p>
      </div>

      {/* about 페이지 헤드라인과 크기를 맞췄다 — 둘 다 이 사이트에서 가장 큰
          글자라 크기가 다르면 "어느 게 더 중요한 문구인지" 헷갈린다.
          원래 이 쪽(5xl~8xl)이 about(4xl~6xl)보다 한 단계씩 더 컸는데,
          그 중간값(4xl~7xl)으로 둘 다 맞췄다. */}
      <h1 className="mt-7 text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
        <span className="block">
          <span className="text-subtext">{hero.headline.lead}</span>
          <span className="text-foreground">{hero.headline.highlightWhite}</span>
          <span className="text-accent">{hero.headline.highlightAccent}</span>
          <span className="text-foreground">{hero.headline.highlightComma}</span>
        </span>
        <span className="mt-1 block text-subtext">
          <span className="text-foreground">{hero.headline.tailHighlight}</span>
          {hero.headline.tailRest}
        </span>
      </h1>

      <p className="mt-10 max-w-xl text-[15px] leading-relaxed text-white/55 sm:max-w-none">
        {hero.bodyLines.map((line) => (
          <span key={line} className="block sm:whitespace-nowrap">
            {line}
          </span>
        ))}
      </p>

      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-white/35">
          클랜원
        </span>
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {members.total.toLocaleString()}명
        </span>
        <span className="text-sm font-medium tabular-nums text-positive">
          +{members.weeklyDelta} <span className="text-positive/60">이번 주</span>
        </span>
      </div>

      <Link
        href={hero.ctaHref}
        className="clip-corner mt-10 inline-flex items-center gap-3 bg-accent px-8 py-4 text-[15px] font-bold text-background transition hover:brightness-110"
      >
        {hero.ctaLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
