import { siteConfig } from '@/lib/siteConfig';

const { about } = siteConfig;

function SectionHeader({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  return (
    <>
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{eyebrow}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{heading}</h2>
    </>
  );
}

export function About() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-shell px-5 py-20 sm:px-8 md:py-28">
          <div className="flex items-center gap-4">
            <p className="hud shrink-0 text-[11px] text-foreground sm:text-xs">{about.eyebrow}</p>
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
          </div>

          <h1 className="mt-7 max-w-3xl text-4xl font-bold leading-[1.25] tracking-tight sm:text-5xl md:text-6xl">
            <span className="block text-accent">{about.headline.emphasis}</span>
            <span className="mt-1 block text-subtext">
              {about.headline.plainLead}
              <span className="text-foreground">{about.headline.plainHighlight}</span>
              {about.headline.plainTail}
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-white/55">{about.body}</p>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <SectionHeader eyebrow={about.why.eyebrow} heading={about.why.heading} />

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/55">{about.why.intro}</p>

        <div className="mt-8 max-w-2xl rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6">
          <p className="hud text-[11px] text-accent">{about.why.calloutLabel}</p>
          <p className="mt-3 text-lg font-bold text-foreground">{about.why.calloutHeading}</p>
          <ul className="mt-4 space-y-2">
            {about.why.calloutPoints.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-white/55">
                <span aria-hidden="true" className="text-accent">
                  ·
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-white/40">{about.why.calloutFooter}</p>
        </div>

        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-white/55">
          {about.why.closing}
          <br />
          <span className="font-bold text-accent">{about.why.closingAccent}</span>
        </p>
      </section>

      {/* ── HOW ── */}
      <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <SectionHeader eyebrow={about.how.eyebrow} heading={about.how.heading} />

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/55">{about.how.intro}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {about.how.steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6"
            >
              <span className="hud text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-2 text-lg font-bold text-foreground">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DATA ── */}
      <section className="mx-auto max-w-shell px-5 pb-24 sm:px-8 md:pb-32">
        <SectionHeader eyebrow={about.data.eyebrow} heading={about.data.heading} />

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/55">{about.data.intro}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {about.data.sources.map((source) => (
            <div
              key={source.name}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-5"
            >
              <span className="hud border border-accent-secondary/50 px-3 py-1 text-[10px] text-accent-secondary">
                {source.tag}
              </span>
              <p className="mt-3 text-base font-bold text-foreground">{source.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{source.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6">
          <p className="hud text-[11px] text-accent">{about.data.endpointsLabel}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/45">{about.data.endpointsIntro}</p>
          <ul className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
            {about.data.endpoints.map((endpoint) => (
              <li key={endpoint.path} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
                <span className="text-xs text-white/40">{endpoint.body}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6">
            <p className="hud text-[11px] text-positive">{about.data.storedLabel}</p>
            <ul className="mt-4 space-y-2">
              {about.data.stored.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-white/55">
                  <span aria-hidden="true" className="text-positive">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6">
            <p className="hud text-[11px] text-menu">{about.data.notStoredLabel}</p>
            <ul className="mt-4 space-y-2">
              {about.data.notStored.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-white/55">
                  <span aria-hidden="true" className="text-menu">
                    ✗
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-white/40">{about.data.closing}</p>
      </section>
    </>
  );
}
