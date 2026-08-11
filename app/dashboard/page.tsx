import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';
import { fetchScrimSessions } from '@/lib/scrimData';
import { fetchRankingStats } from '@/lib/rankingStats';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.dashboard.pageHeading} | ${siteConfig.siteName}`,
};

// 내전은 주 2회 들어오므로 매 요청마다 새로 읽을 이유가 없다.
export const revalidate = 300;

export default async function DashboardPage() {
  const [sessions, recent10, alltime] = await Promise.all([
    fetchScrimSessions(),
    fetchRankingStats('recent10'),
    fetchRankingStats('alltime'),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <h1 className="sr-only">{siteConfig.dashboard.pageHeading}</h1>
      <TierRankingPodium recent10={recent10} alltime={alltime} />
      <RecentScrimsList sessions={sessions} />
      <Footer />
    </main>
  );
}
