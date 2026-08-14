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

export default async function MatchesPage() {
  const sessions = await fetchScrimSessions();

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <h1 className="sr-only">{siteConfig.matches.pageHeading}</h1>
      <RecentScrimsList sessions={sessions} />
      <Footer />
    </main>
  );
}
