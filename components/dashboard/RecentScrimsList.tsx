import { SCRIM_SESSIONS, formatScrimDate, getRecentScrims, type ScrimSession } from '@/lib/dashboardData';
import { siteConfig } from '@/lib/siteConfig';

export function RecentScrimsList({ sessions = SCRIM_SESSIONS }: { sessions?: ScrimSession[] } = {}) {
  const recentScrimsCopy = siteConfig.dashboard.recentScrims;
  const recent = getRecentScrims(sessions);

  return (
    <section className="mx-auto max-w-shell px-5 pb-24 sm:px-8 md:pb-32">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{recentScrimsCopy.eyebrow}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
        {recentScrimsCopy.heading}
      </h2>

      <ul className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {recent.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div>
              <p className="font-bold text-foreground">{session.title}</p>
              <p className="mt-1 text-sm text-menu">
                {formatScrimDate(session.date)} · {session.participantCount}
                {recentScrimsCopy.participantSuffix} · {session.matchCount}
                {recentScrimsCopy.matchSuffix}
              </p>
            </div>
            {session.replayUrl ? (
              <a
                href={session.replayUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md border border-accent/50 px-4 py-2 text-center text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-background"
              >
                {recentScrimsCopy.replayLabel}
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-center text-sm text-white/25"
              >
                {recentScrimsCopy.replayPendingLabel}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
