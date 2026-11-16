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
                // 칸: 등수 | 닉네임·티어 | 한 줄 평 | 반응속도(2026-11-16 사용자 요청).
                // 닉네임·티어 칸을 12rem 으로 고정(지금 가장 긴 Ez_MANDUUUUU+티어가 172px)하고 반응속도 칸도
                // 고정(5.5rem)해서, 모든 줄의 한 줄 평이 티어 바로 옆 같은 x 에서 왼쪽 정렬로 시작한다.
                // 그보다 긴 이름만 말줄임. 반응속도 칸을 auto 로 두면 줄마다
                // 숫자 폭이 달라 시작점이 흔들린다. 폰(sm 미만)은 칸을 나누면 이름이 너무 잘려서 이름 아래 줄로 —
                // 거기선 시작점을 맞출 일이 없으니 반응속도 칸도 내용 폭(auto)으로 둬서 이름 자리를 남긴다.
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-2.5 sm:grid-cols-[2rem_12rem_minmax(0,1fr)_5.5rem] ${
                  medal ? `border ${MEDAL_BORDER[medal]} ${MEDAL_GRADIENT[medal]}` : 'border border-transparent'
                } ${mine ? 'ring-2 ring-accent' : ''}`}
              >
                <span className="col-start-1 row-start-1 flex justify-center text-sm font-bold tabular-nums text-menu" aria-label={`${entry.rank}등`}>
                  {medal ? <TrophySquare rank={medal} size="sm" /> : entry.rank}
                </span>
                <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">{entry.name}</span>
                  <TierBadge tier={entry.tier} className="shrink-0" />
                </span>
                {entry.comment && (
                  // 마우스 올리면 전체. 칸보다 길면 끝만 말줄임.
                  // text-sm 흰색 — 회색 작은 글씨는 안 보인다는 요청(2026-11-16).
                  <span
                    className="col-span-2 col-start-2 row-start-2 min-w-0 truncate text-sm text-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1"
                    title={entry.comment}
                  >
                    “{entry.comment}”
                  </span>
                )}
                <span className="col-start-3 row-start-1 text-right sm:col-start-4">
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
