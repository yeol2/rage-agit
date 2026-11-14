import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Footer } from '@/components/Footer';
import { RecordCard } from '@/components/hallOfFame/RecordCard';
import { RecordCarousel } from '@/components/hallOfFame/RecordCarousel';
import { fetchHallOfFame } from '@/lib/hallOfFameData';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.hallOfFame.heading} | ${siteConfig.siteName}`,
};

// 다른 기록 화면과 같은 기준(5분). 우승 확정·폴링이 revalidateRecordPages 로
// 바로 지우고, 그 경로를 안 거치는 갱신을 위해 시간 상한을 같이 둔다.
export const revalidate = 300;

export default async function HallOfFamePage() {
  const boards = await fetchHallOfFame();
  const copy = siteConfig.hallOfFame;

  return (
    <main className="min-h-screen">
      <Nav />
      <LiveRefresh />
      <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <div className="flex items-center gap-4">
          <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{copy.eyebrow}</p>
          <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{copy.heading}</h1>
        {/* 읽는 법 — 번호 매긴 네 줄을 박스 하나에. */}
        <ol className="mt-5 max-w-xl space-y-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-sm text-menu">
          {copy.rules.map((rule, i) => (
            <li key={rule} className="flex gap-2.5">
              <span className="w-4 shrink-0 font-bold tabular-nums text-accent">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <RecordCarousel>
            {boards.map((board) => (
              <RecordCard key={board.id} board={board} />
            ))}
          </RecordCarousel>
        </div>
      </section>
      <Footer />
    </main>
  );
}
