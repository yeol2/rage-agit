import { siteConfig } from '@/lib/siteConfig';

const { features } = siteConfig;

export function Features() {
  return (
    <section className="mx-auto max-w-shell px-5 pb-24 sm:px-8 md:pb-32">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{features.eyebrow}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>

      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{features.heading}</h2>

      <ul className="mt-16 border-t border-white/[0.07]">
        {features.items.map((item, i) => (
          <li
            key={item.title}
            className="flex flex-col gap-4 border-b border-white/[0.07] py-12 md:flex-row md:items-start md:gap-10"
          >
            <span
              aria-hidden="true"
              className="w-14 shrink-0 text-3xl font-bold tabular-nums text-subtext"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className={item.ready ? 'flex-1' : 'flex-1 opacity-40'}>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">{item.body}</p>
            </div>

            {!item.ready && (
              <span className="hud mt-1 shrink-0 self-start border border-accent-secondary/50 px-4 py-2 text-[10px] text-accent-secondary">
                COMING SOON
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
