import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <TierRankingPodium />
      <RecentScrimsList />
      <Footer />
    </main>
  );
}
