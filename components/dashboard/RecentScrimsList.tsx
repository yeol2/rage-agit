import { ScrimSessionRow } from './ScrimSessionRow';
import { type ScrimSessionSummary } from '@/lib/scrimData';
import { siteConfig } from '@/lib/siteConfig';

export function RecentScrimsList({ sessions }: { sessions: ScrimSessionSummary[] }) {
  const recentScrimsCopy = siteConfig.dashboard.recentScrims;

  return (
    <section className="mx-auto max-w-shell px-5 py-16 sm:px-8 md:pb-32">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{recentScrimsCopy.eyebrow}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
        {recentScrimsCopy.heading}
      </h2>

      {sessions.length === 0 ? (
        <p className="mt-10 text-menu">아직 수집된 내전이 없습니다.</p>
      ) : (
        // 조회 함수는 넘기지 않는다 — 서버에서 클라이언트로 함수는 건너가지 못한다.
        // ScrimSessionRow 가 기본값으로 브라우저에서 직접 가져온다.
        <ul className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {sessions.map((session) => (
            <ScrimSessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </section>
  );
}
