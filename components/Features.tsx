import { siteConfig } from '@/lib/siteConfig';

const { features } = siteConfig;

export function Features() {
  return (
    <section className="mx-auto max-w-shell px-8 pb-32">
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute -left-4 -top-6 h-6 w-6 border-l border-t border-accent/70"
        />
        <p className="hud text-[11px] text-accent">{features.eyebrow}</p>
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
              className="w-14 shrink-0 text-3xl font-bold tabular-nums text-muted"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className={item.ready ? 'flex-1' : 'flex-1 opacity-40'}>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">{item.body}</p>
            </div>

            {!item.ready && (
              <span className="hud mt-1 shrink-0 border border-accent/40 px-4 py-2 text-[10px] text-accent">
                COMING SOON
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
