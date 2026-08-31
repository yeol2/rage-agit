import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { fetchRankingStats } from '@/lib/rankingStats';
import { fetchRankingSnapshots } from '@/lib/rankingSnapshot';
import { fetchRecentSessions, fetchSessionStandings } from '@/lib/memberDashboard';
import { fetchMapBadges } from '@/lib/mapStats';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.dashboard.pageHeading} | ${siteConfig.siteName}`,
};

// 시간 기반(예: 5분마다) 캐시를 쓰지 않는다 — 그러면 내전 도중 1~3매치만
// 폴링된 상태로 5분 창이 열려 있는 동안 리더보드가 그 부분 데이터로 계산된
// 순위를 잠깐 보여줄 수 있다(등수 변동 스냅샷은 4매치 확인 후에만 찍는데
// 리더보드 본문은 그보다 먼저 바뀌는 셈이라 서로 어긋난다). 대신 캐시를
// 무기한 유지하다가, 03 폴링이 그 세션의 4번째 라운드 도달을 확인하는
// 순간(app/api/scrim-roster/round-sheet/poll/route.ts)에만
// revalidatePath('/dashboard')로 명시적으로 갱신한다 — 등수 변동 스냅샷
// 캡처와 정확히 같은 트리거다.
export const revalidate = false;

export default async function DashboardPage() {
  const [recent16, alltime, snapshots, sessions, mapBadges] = await Promise.all([
    fetchRankingStats('recent16'),
    fetchRankingStats('alltime'),
    fetchRankingSnapshots(),
    fetchRecentSessions(),
    // 맵마다 한 명씩, 클랜 전체에서 여덟 자리뿐이라 통째로 받아 표에 나눠준다.
    fetchMapBadges(),
  ]);
  // 드롭다운을 펼칠 때마다 조회하지 않고 한 번에 받아둔다 — 최근 10회 × 64명이라
  // 크기가 정해져 있고(약 640행), 어차피 누굴 펼칠지 미리 알 수 없다.
  const standings = await fetchSessionStandings(sessions.map((s) => s.scrimDate));

  return (
    <main className="min-h-screen">
      <Nav />
      <LiveRefresh />
      <h1 className="sr-only">{siteConfig.dashboard.pageHeading}</h1>
      <TierRankingPodium
        recent16={recent16}
        alltime={alltime}
        snapshots={snapshots}
        sessions={sessions}
        mapBadges={mapBadges}
        standings={standings}
      />
      <Footer />
    </main>
  );
}
