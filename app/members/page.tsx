import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { AccessGate } from '@/components/members/AccessGate';
import { MemberDirectory } from '@/components/members/MemberDirectory';
import { fetchAllMembers } from '@/lib/memberStats';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.memberDirectory.pageHeading} | ${siteConfig.siteName}`,
};

// 218명 명단이 자주 안 바뀌므로 매 요청마다 새로 읽을 이유가 없다.
export const revalidate = 300;

export default async function MembersPage() {
  const members = await fetchAllMembers();
  const copy = siteConfig.memberDirectory;

  return (
    <main className="min-h-screen">
      <Nav />
      <AccessGate>
        <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
          <div className="flex items-center gap-4">
            <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{copy.eyebrow}</p>
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{copy.heading}</h1>
          <div className="mt-10">
            <MemberDirectory members={members} />
          </div>
        </section>
      </AccessGate>
      <Footer />
    </main>
  );
}
