import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { fetchRankingStats } from '@/lib/rankingStats';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.dashboard.pageHeading} | ${siteConfig.siteName}`,
};

// 랭킹 집계가 자주 안 바뀌므로 매 요청마다 새로 읽을 이유가 없다.
export const revalidate = 300;

export default async function DashboardPage() {
  const [recent12, alltime] = await Promise.all([
    fetchRankingStats('recent12'),
    fetchRankingStats('alltime'),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <h1 className="sr-only">{siteConfig.dashboard.pageHeading}</h1>
      <TierRankingPodium recent12={recent12} alltime={alltime} />
      <Footer />
    </main>
  );
}
