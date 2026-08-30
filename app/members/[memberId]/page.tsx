import { notFound } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Footer } from '@/components/Footer';
import { Hexagon } from '@/components/members/Hexagon';
import { MemberDashboard } from '@/components/members/MemberDashboard';
import { PartnerChemistry } from '@/components/members/PartnerChemistry';
import { WinTrophies } from '@/components/members/WinTrophies';
import {
  buildWindowStats,
  fetchMemberStandings,
  fetchRecentSessions,
} from '@/lib/memberDashboard';
import { fetchRankingStats } from '@/lib/rankingStats';
import {
  MIN_GAMES_FOR_HEXAGON,
  buildHexagonAxes,
  cleanDisplayName,
  fetchMember,
  fetchMemberRecentStats,
  fetchMemberWinCount,
  fetchHexagonCohort,
  stripTrailingKoreanTag,
  tierColorRamp,
  tierGroupFor,
} from '@/lib/memberStats';
import {
  fetchPartnerNames,
  fetchPartnerStats,
  pickPartners,
  type PartnerCard,
  type PartnerStat,
} from '@/lib/partnerStats';
import { siteConfig } from '@/lib/siteConfig';

// 다른 기록 화면들과 같은 기준이다(/members, /matches). 폴링·우승 확정이
// revalidateRecordPages 로 즉시 지우지만, 크론 폴링처럼 그 라우트를 안 거치는
// 경로도 있어서 시간 상한을 같이 둔다.
export const revalidate = 300;

export default async function MemberDetailPage({
  params,
}: {
  params: { memberId: string };
}) {
  const member = await fetchMember(params.memberId);
  if (!member) notFound();

  const [stats, winCount, alltimeRows, recent16Rows, sessions, standings, partnerRows] =
    await Promise.all([
      fetchMemberRecentStats(member.id),
      fetchMemberWinCount(member.id),
      fetchRankingStats('alltime'),
      fetchRankingStats('recent16'),
      fetchRecentSessions(),
      fetchMemberStandings(member.id),
      fetchPartnerStats(member.id),
    ]);

  // 양 끝에 선 사람들만 이름이 필요하다 — 후보 전원을 조회하지 않는다.
  // 동률이면 한 칸에 여러 명이 서므로 개수는 정해져 있지 않다.
  const partners = pickPartners(partnerRows);
  const partnerNames = await fetchPartnerNames(
    [...partners.best, ...partners.worst].map((stat) => stat.partnerId),
  );
  const toPartnerCards = (stats: PartnerStat[]): PartnerCard[] =>
    stats.flatMap((stat) => {
      const name = partnerNames.get(stat.partnerId);
      if (!name) return [];
      return [
        {
          ...stat,
          displayName: stripTrailingKoreanTag(cleanDisplayName(name.discordNickname)),
          tier: name.tier,
        },
      ];
    });

  const dashboardStats = {
    alltime: buildWindowStats(member.id, alltimeRows),
    recent16: buildWindowStats(member.id, recent16Rows),
  };
  const standingByDate = new Map(standings.map((row) => [row.scrimDate, row.standing]));
  const hasEnoughGames = stats !== null && stats.gameCount >= MIN_GAMES_FOR_HEXAGON;

  // 눈금은 클랜 전체 기준 하나이고 점선만 티어 그룹 평균이다(buildHexagonAxes
  // 주석 참고). 그래서 표본을 한 번만 받아 여기서 그룹을 갈라 넘긴다.
  const tierGroup = tierGroupFor(member.tier);
  const cohort = hasEnoughGames && tierGroup ? await fetchHexagonCohort() : [];
  const groupCohort = tierGroup ? cohort.filter((row) => tierGroup.tiers.includes(row.tier)) : cohort;
  const axes = hasEnoughGames && stats ? buildHexagonAxes(stats, cohort, groupCohort) : null;
  const ramp = tierColorRamp(member.tier);

  return (
    <main className="min-h-screen">
      <Nav />
      <LiveRefresh />
      <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <div
          className="mx-auto max-w-[880px] rounded-2xl border px-6 py-10 text-center sm:px-8"
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
          <WinTrophies count={winCount} />

          {/* 숫자를 먼저 보고 6각형으로 넘어가는 흐름 — 대시보드가 6각형 위에 온다. */}
          <div className="mt-8 border-t border-white/[0.08] pt-6 text-left">
            <MemberDashboard
              stats={dashboardStats}
              sessions={sessions}
              standingByDate={standingByDate}
              ramp={ramp}
            />
          </div>

          {/* 전적 요약(혼자 얼마나 잘했나) 다음에 "누구와 있을 때 잘했나"가 온다. */}
          <div className="mt-8 border-t border-white/[0.08] pt-6 text-left">
            <PartnerChemistry
              best={toPartnerCards(partners.best)}
              worst={toPartnerCards(partners.worst)}
            />
          </div>

          <div className="mt-10 flex justify-center">
            {axes ? (
              <Hexagon axes={axes} />
            ) : (
              <p className="text-menu">{siteConfig.memberDirectory.insufficientDataMessage}</p>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
