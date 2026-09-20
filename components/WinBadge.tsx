'use client';

import { useId, type ReactNode } from 'react';
import { TROPHY_VIEWBOX, TrophyGoldGradient, TrophyPaths } from '@/components/TrophyGlyph';
import { BadgeTooltip } from '@/components/badges/BadgeTooltip';
import { BADGE_COPY } from '@/components/badges/badgeCatalog';

/**
 * 내전우승 뱃지 — 트로피 하나에 횟수를 숫자로 겹쳐 얹는다.
 *
 * 예전에는 횟수만큼 트로피를 늘어놓았다. 우승이 쌓일수록 가로로 길어져서 4위
 * 이하 표에서는 뱃지 칸을 넘겼고(모바일 48px 칸은 4개부터 잘린다), 그걸 막으려고
 * 화면 폭에 따라 두 벌을 그려두고 CSS 로 골라 보였다. 한 벌로 줄이면 폭이
 * 횟수와 무관하게 고정되고, 몇 번인지도 한눈에 읽힌다 — 트로피 여덟 개를 세는
 * 것보다 숫자 '8' 이 빠르다.
 *
 * 한때 다른 뱃지처럼 육각 틀 안에 넣어봤는데, 22px 칸에서는 틀이 자리를 다 먹고
 * 트로피가 안 보였다. 틀 없이 트로피만 그리는 지금 모양이 작은 칸에서 제일 잘
 * 읽힌다.
 *
 * 크기는 바깥에서 글자 크기(className 의 text-*)로 정한다. 트로피와 숫자가 모두
 * em 단위라 하나만 바꾸면 둘이 같은 비율로 커진다.
 */
export interface WinBadgeProps {
  count: number;
  /** 크기를 정하는 곳. text-* 하나면 트로피와 숫자가 같이 커진다. */
  className?: string;
  /** 우승이 0회일 때 대신 그릴 것. 표는 '-' 를 넣어 칸이 비어 보이지 않게 한다. */
  none?: ReactNode;
  /**
   * 숫자 뒤 알약 색. 뒤에 깔린 배경과 같아야 트로피가 알약 뒤로 지나가는 것처럼
   * 보인다. 기본값은 카드·표 줄에 공통으로 쓰는 그래파이트다.
   */
  chipColor?: string;
}

const DEFAULT_CHIP_COLOR = '#1B1B23';

function Trophy({ gradientId, className }: { gradientId: string; className: string }) {
  return (
    <svg viewBox={TROPHY_VIEWBOX} className={className} aria-hidden>
      <defs>
        <TrophyGoldGradient id={gradientId} />
      </defs>
      <g fill={`url(#${gradientId})`}>
        <TrophyPaths />
      </g>
    </svg>
  );
}

export function WinBadge({
  count,
  className = '',
  none = null,
  chipColor = DEFAULT_CHIP_COLOR,
}: WinBadgeProps) {
  // 같은 문서에 이 뱃지가 수십 개 깔리므로 그라디언트 id 가 겹치면 안 된다.
  const goldId = `win-gold-${useId().replace(/:/g, '')}`;

  if (count <= 0) return <>{none}</>;

  return (
    <span
      className={`group relative inline-flex w-fit shrink-0 items-center justify-center ${className}`}
      data-testid="win-badge"
    >
      {/* 트로피와 숫자를 한 덩어리로 묶는다 — 숫자 자리는 바깥 상자가 아니라
          트로피 기준이어야 한다. */}
      <span className="relative inline-flex">
        <Trophy gradientId={goldId} className="h-[1.55em] w-auto" />

        {/* 트로피 몸통 아래쪽에 얹는다. 받침 위에서 멈춰서 받침은 그대로 보이고,
            숫자는 트로피 안쪽에 박힌 것처럼 읽힌다. */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 min-w-[1.15em] -translate-x-1/2 -translate-y-[26%] rounded-full px-[0.22em] text-center text-[0.72em] font-bold leading-[1.35] tabular-nums text-[#FFD365]"
          style={{ background: chipColor, boxShadow: `0 0 0 1px ${chipColor}` }}
        >
          {count}
        </span>
      </span>

      <BadgeTooltip
        testId="badge-tooltip-scrimWin"
        name={BADGE_COPY.scrimWin.name}
        description={BADGE_COPY.scrimWin.description}
        detail={`내전 종합 1위 ${count}회`}
        artwork={<Trophy gradientId={`${goldId}-big`} className="h-11 w-auto" />}
      />
    </span>
  );
}
