import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.dashboard.pageHeading} | ${siteConfig.siteName}`,
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <h1 className="sr-only">{siteConfig.dashboard.pageHeading}</h1>
      <TierRankingPodium />
      <RecentScrimsList />
      <Footer />
    </main>
  );
}
