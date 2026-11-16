import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { ReactionPlayground } from '@/components/reaction/ReactionPlayground';
import { fetchReactionRanking } from '@/lib/reactionData';
import { siteConfig } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: `${siteConfig.reaction.heading} | ${siteConfig.siteName}`,
};

// 다른 사람이 방금 올린 기록도 보이게 매번 새로 읽는다. 내 기록은 등록 응답으로 바로 갱신된다.
export const dynamic = 'force-dynamic';

export default async function ReactionPage() {
  const ranking = await fetchReactionRanking();
  const copy = siteConfig.reaction;

  return (
    <main className="min-h-screen">
      <Nav />
      {/* 모든 칸(제목·배너·설명·경기장·랭킹)을 사이트 폭(max-w-shell, 메뉴바와 같은 좌우선)에 맞춘다(2026-11-16 사용자 요청). */}
      <div className="mx-auto max-w-shell px-5 pb-16 pt-16 sm:px-8">
      <section>
        <div className="flex items-center gap-4">
          <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">{copy.eyebrow}</p>
          <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{copy.heading}</h1>
        <p className="mt-3 text-sm text-menu">
          적이 보이는 순간 몇 ms 만에 반응하나요? 아무나 해볼 수 있고, 랭킹은 클랜원만 올라갑니다.
        </p>

        {Date.now() < Date.parse(copy.prize.endsAt) && (
          <p className="mt-6 flex items-center gap-3 rounded-xl border border-[rgba(255,224,77,0.5)] bg-[linear-gradient(90deg,rgba(255,224,77,0.16),rgba(255,224,77,0.03))] px-4 py-3 text-sm font-bold text-foreground">
            <span aria-hidden="true" className="text-lg">🏆</span>
            {copy.prize.text}
          </p>
        )}

      </section>

      <div className="mt-10">
        <ReactionPlayground initialRanking={ranking} />
      </div>
      </div>
      <Footer />
    </main>
  );
}
