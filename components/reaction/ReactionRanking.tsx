import { TierBadge } from '@/components/TierBadge';
import { TrophySquare } from '@/components/TrophySquare';
import { MEDAL_BORDER, MEDAL_GRADIENT, medalOf } from '@/lib/medalStyles';
import type { ReactionRankEntry } from '@/lib/reaction';
import { siteConfig } from '@/lib/siteConfig';

// 오른쪽 랭킹표. 명예의 전당 카드와 같은 양식(금·은·동 줄 + 트로피 등수 칸).
export function ReactionRanking({
  ranking,
  highlightMemberId,
}: {
  ranking: ReactionRankEntry[];
  highlightMemberId: string | null;
}) {
  return (
    <section
      aria-label={siteConfig.reaction.rankingHeading}
      className="rounded-2xl border border-white/[0.06] bg-[#1B1B23] p-3 sm:p-5"
    >
      <h2 className="text-center text-xl font-bold tracking-tight text-foreground">
        {siteConfig.reaction.rankingHeading}
      </h2>
      <span aria-hidden="true" className="mx-auto mt-2.5 block h-[3px] w-10 rounded-full bg-accent" />
      <p className="mt-5 text-center text-xs leading-relaxed text-menu">
        5회 평균이 빠른 순 · 한 사람당 최고 기록 하나
      </p>

      {ranking.length === 0 ? (
        <p className="py-10 text-center text-sm text-menu">아직 아무도 없어요. 1등 자리 비어있습니다.</p>
      ) : (
        <ol className="mt-2.5 space-y-1.5">
          {ranking.map((entry) => {
            const medal = medalOf(entry.rank);
            const mine = entry.memberId === highlightMemberId;
            return (
              <li
                key={entry.memberId}
                data-mine={mine || undefined}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 ${
                  medal ? `border ${MEDAL_BORDER[medal]} ${MEDAL_GRADIENT[medal]}` : 'border border-transparent'
                } ${mine ? 'ring-2 ring-accent' : ''}`}
              >
                <span className="flex justify-center text-sm font-bold tabular-nums text-menu" aria-label={`${entry.rank}등`}>
                  {medal ? <TrophySquare rank={medal} size="sm" /> : entry.rank}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{entry.name}</span>
                    <TierBadge tier={entry.tier} className="shrink-0" />
                  </span>
                  {/* 한 줄 평 — 20자까지라 보통 한 줄에 들어가고, 좁은 폰에서만 말줄임. */}
                  {entry.comment && (
                    <span className="mt-0.5 block truncate text-xs text-menu" title={entry.comment}>
                      “{entry.comment}”
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold tabular-nums text-foreground">
                    {entry.bestAvgMs}
                    <span className="ml-0.5 text-xs font-normal text-menu">ms</span>
                  </span>
                  <span className="block text-[11px] tabular-nums text-subtext">최고 {entry.bestSingleMs}ms</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
