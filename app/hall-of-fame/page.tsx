import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Footer } from '@/components/Footer';
import { RecordCard } from '@/components/hallOfFame/RecordCard';
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
        <p className="mt-3 text-sm text-menu">{copy.description}</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {boards.map((board) => (
            <RecordCard key={board.id} board={board} />
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
