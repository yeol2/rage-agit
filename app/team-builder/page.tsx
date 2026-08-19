import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { AccessGate } from '@/components/members/AccessGate';
import { RosterUploadForm } from '@/components/team-builder/RosterUploadForm';
import { RosterBoard } from '@/components/team-builder/RosterBoard';
import { fetchLatestRoster } from '@/lib/scrimRoster';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `팀 구성 테이블 | ${siteConfig.siteName}`,
};

// 관리자가 파일을 올리면 바로 최신 상태가 보여야 한다 — 캐시를 두지 않는다.
export const dynamic = 'force-dynamic';

export default async function TeamBuilderPage() {
  const roster = await fetchLatestRoster();

  return (
    <main className="min-h-screen">
      <Nav />
      <AccessGate>
        <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
          <div className="flex items-center gap-4">
            <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">TEAM BUILDER</p>
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
            <span style={{ color: '#322F36' }}>01</span> 티어 테이블
          </h1>

          <div className="mt-8">
            <RosterUploadForm />
          </div>

          <div className="mt-10">
            {/* RosterBoard는 드래그 상태를 클라이언트에 들고 있다 — 새 명단을 업로드해
                roster.id가 바뀌면 key로 강제 리마운트해서 이전 명단 상태가 새지 않게 한다. */}
            <RosterBoard key={roster?.id ?? 'empty'} roster={roster} />
          </div>
        </section>
      </AccessGate>
      <Footer />
    </main>
  );
}
