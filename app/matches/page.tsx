import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Footer } from '@/components/Footer';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';
import { RoundSheetTable, type RoundSheetTeam } from '@/components/team-builder/RoundSheetTable';
import { fetchScrimSessions } from '@/lib/scrimData';
import { buildRoundSheet, latestScrimDate } from '@/lib/roundSheetData';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { scrimSessionTitle } from '@/supabase/functions/_shared/sessions.mjs';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.matches.pageHeading} | ${siteConfig.siteName}`,
};

// 내전은 주 2회 들어오므로 매 요청마다 새로 읽을 이유가 없다. 라운드가 들어오거나
// 우승이 확정되면 revalidateRecordPages 가 이 화면 캐시를 바로 버린다.
export const revalidate = 300;

// dak.gg 백필(~2026-07-25) 등수·팀 번호가 실제 경기와 안 맞는 경우가 있어
// 2026-07-26부터만 매치 기록에 보여준다 — DB 데이터 자체는 안 지운다.
const VISIBLE_SINCE = '2026-07-26';

/**
 * 가장 최근 내전의 03 시트. 03 화면과 같은 계산(buildRoundSheet)이라 숫자가
 * 어긋날 수 없다. 시트 테이블들은 anon 이 못 읽으므로 서버에서 service role 로
 * 읽고, 우승 확정용 memberIds 는 클라이언트로 안 넘긴다. 실패해도 목록은 보여야
 * 하므로 null 로 넘어간다.
 */
async function fetchLatestSheet(): Promise<{ scrimDate: string; teams: RoundSheetTeam[] } | null> {
  try {
    const supabase = getSupabaseServer();
    const scrimDate = await latestScrimDate(supabase);
    if (!scrimDate) return null;
    const sheet = await buildRoundSheet(supabase, scrimDate);
    if (sheet.teams.length === 0) return null;
    return { scrimDate, teams: sheet.teams.map(({ memberIds: _memberIds, ...team }) => team) };
  } catch {
    return null;
  }
}

export default async function MatchesPage() {
  // 개수 제한 없이 VISIBLE_SINCE 이후 전부 보여준다(2026-11-14 사용자 요청).
  const [sessions, latestSheet] = await Promise.all([
    fetchScrimSessions(undefined, VISIBLE_SINCE),
    fetchLatestSheet(),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <LiveRefresh />
      <h1 className="sr-only">{siteConfig.matches.pageHeading}</h1>
      <RecentScrimsList sessions={sessions}>
        {/* 최근 내전 결과 — 03 시트를 버튼 없이 표만, 가운데에. */}
        {latestSheet && (
          <div className="mt-10">
            <p className="hud mb-3 text-center text-xs text-menu">{scrimSessionTitle(latestSheet.scrimDate)}</p>
            <RoundSheetTable data={latestSheet} />
          </div>
        )}
      </RecentScrimsList>
      <Footer />
    </main>
  );
}
