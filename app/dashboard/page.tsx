import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { fetchRankingStats } from '@/lib/rankingStats';
import { fetchRankingSnapshots } from '@/lib/rankingSnapshot';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.dashboard.pageHeading} | ${siteConfig.siteName}`,
};

// 랭킹 집계가 자주 안 바뀌므로 매 요청마다 새로 읽을 이유가 없다.
export const revalidate = 300;

export default async function DashboardPage() {
  const [recent16, alltime, snapshots] = await Promise.all([
    fetchRankingStats('recent16'),
    fetchRankingStats('alltime'),
    fetchRankingSnapshots(),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <h1 className="sr-only">{siteConfig.dashboard.pageHeading}</h1>
      <TierRankingPodium recent16={recent16} alltime={alltime} snapshots={snapshots} />
      <Footer />
    </main>
  );
}
