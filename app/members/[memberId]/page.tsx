import { notFound } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { AccessGate } from '@/components/members/AccessGate';
import { Hexagon } from '@/components/members/Hexagon';
import {
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  cleanDisplayName,
  fetchMember,
  fetchMemberRecentStats,
  fetchTierCohortStats,
  tierGroupFor,
} from '@/lib/memberStats';
import { siteConfig } from '@/lib/siteConfig';

export default async function MemberDetailPage({
  params,
}: {
  params: { memberId: string };
}) {
  const member = await fetchMember(params.memberId);
  if (!member) notFound();

  const stats = await fetchMemberRecentStats(member.id);
  const hasEnoughGames = stats !== null && stats.gameCount >= MIN_GAMES_FOR_HEXAGON;

  const tierGroup = tierGroupFor(member.tier);
  const cohort = hasEnoughGames && tierGroup ? await fetchTierCohortStats(tierGroup.tiers) : [];
  const axes = hasEnoughGames && stats ? buildHexagonAxes(stats, cohort) : null;

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <AccessGate>
        <section className="mx-auto max-w-shell px-5 py-16 text-center sm:px-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {cleanDisplayName(member.discordNickname)}
          </h1>
          <p className="mt-2 text-sm text-menu">{member.tier}티어</p>

          <div className="mt-10 flex justify-center">
            {axes ? (
              <Hexagon axes={axes} />
            ) : (
              <p className="text-menu">{siteConfig.memberDirectory.insufficientDataMessage}</p>
            )}
          </div>
        </section>
      </AccessGate>
      <Footer />
    </main>
  );
}
