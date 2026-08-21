import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';
import { fetchScrimSessions } from '@/lib/scrimData';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.matches.pageHeading} | ${siteConfig.siteName}`,
};

// 내전은 주 2회 들어오므로 매 요청마다 새로 읽을 이유가 없다.
export const revalidate = 300;

// dak.gg 백필(~2026-07-25) 등수·팀 번호가 실제 경기와 안 맞는 경우가 있어
// 2026-07-26부터만 매치 기록에 보여준다 — DB 데이터 자체는 안 지운다.
const VISIBLE_SINCE = '2026-07-26';

export default async function MatchesPage() {
  const sessions = await fetchScrimSessions(10, VISIBLE_SINCE);

  return (
    <main className="min-h-screen">
      <Nav />
      <h1 className="sr-only">{siteConfig.matches.pageHeading}</h1>
      <RecentScrimsList sessions={sessions} />
      <Footer />
    </main>
  );
}
