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
  stripTrailingKoreanTag,
  tierColorRamp,
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
  const ramp = tierColorRamp(member.tier);

  return (
    <main className="min-h-screen">
      <Nav />
      <AccessGate>
        <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
          <div
            className="mx-auto max-w-lg rounded-2xl border px-8 py-10 text-center"
            style={{
              background: `linear-gradient(160deg, ${ramp.from}1f, ${ramp.to}1f)`,
              borderColor: `${ramp.from}66`,
              boxShadow: `0 0 24px ${ramp.from}33`,
            }}
          >
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {stripTrailingKoreanTag(cleanDisplayName(member.discordNickname))}
            </h1>
            <p className="mt-2 text-sm text-menu">{member.tier}티어</p>

            <div className="mt-10 flex justify-center">
              {axes ? (
                <Hexagon axes={axes} />
              ) : (
                <p className="text-menu">{siteConfig.memberDirectory.insufficientDataMessage}</p>
              )}
            </div>
          </div>
        </section>
      </AccessGate>
      <Footer />
    </main>
  );
}
