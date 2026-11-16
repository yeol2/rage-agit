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
                {/* 닉네임 · 티어 · 한 줄 평을 한 줄에 나란히(2026-11-16 사용자 요청 — 아래 줄 말고).
                    한 줄 평은 이름·티어를 다 놓고 남은 폭만 쓴다(flex-1 basis-0) — 좁으면 한 줄 평 끝만 말줄임,
                    한 줄 평이 없는데도 모자랄 만큼 긴 이름만 말줄임된다. 한 줄 평은 마우스 올리면 전체가 보인다. */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">{entry.name}</span>
                  <TierBadge tier={entry.tier} className="shrink-0" />
                  {entry.comment && (
                    // 티어 뱃지와 오른쪽 반응속도(ms) 사이 남은 칸의 한가운데(text-center, 2026-11-16 사용자 요청).
                    // px-3 — 칸이 좁아 말줄임될 때도 뱃지·숫자에 붙어 보이지 않게.
                    <span className="min-w-0 flex-1 basis-0 truncate px-3 text-center text-xs text-menu" title={entry.comment}>
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
