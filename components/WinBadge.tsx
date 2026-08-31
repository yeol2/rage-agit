'use client';

import { useId, type ReactNode } from 'react';
import { TROPHY_VIEWBOX, TrophyGoldGradient, TrophyPaths } from '@/components/TrophyGlyph';

/**
 * 내전 종합우승 뱃지 — 트로피 하나에 횟수를 숫자로 겹쳐 얹는다.
 *
 * 예전에는 횟수만큼 트로피를 늘어놓았다. 우승이 쌓일수록 가로로 길어져서 4위
 * 이하 표에서는 뱃지 칸을 넘겼고(모바일 48px 칸은 4개부터 잘린다), 그걸 막으려고
 * 화면 폭에 따라 두 벌을 그려두고 CSS 로 골라 보였다. 한 벌로 줄이면 폭이
 * 횟수와 무관하게 고정되고, 몇 번인지도 한눈에 읽힌다 — 트로피 여덟 개를 세는
 * 것보다 숫자 '8' 이 빠르다.
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
  /**
   * 문서에 이미 있는 금색 그라디언트 id. 표처럼 수십 개가 깔리는 곳은 정의를
   * 하나만 두고 그 id 를 넘긴다. 안 넘기면 이 뱃지가 자기 것을 하나 만든다.
   */
  gradientId?: string;
  /** 광택이 한 번 훑고 지나가게 한다. 칸이 넉넉한 화면에서만 쓴다. */
  sheen?: boolean;
}

const DEFAULT_CHIP_COLOR = '#1B1B23';

// 말풍선 바탕. 리더보드 물음표 말풍선과 같은 색이다.
const TOOLTIP_BG = '#1B1B23';

// 광택 띠의 폭(svg 사용자 좌표). 좁을수록 날카롭게 반짝인다.
const SHEEN_WIDTH = 7;

export function WinBadge({
  count,
  className = '',
  none = null,
  chipColor = DEFAULT_CHIP_COLOR,
  gradientId,
  sheen = false,
}: WinBadgeProps) {
  const localId = useId().replace(/:/g, '');
  const goldId = gradientId ?? `win-gold-${localId}`;
  const clipId = `win-clip-${localId}`;
  const sheenId = `win-sheen-${localId}`;

  if (count <= 0) return <>{none}</>;

  return (
    <span
      className={`group relative inline-flex w-fit shrink-0 items-center justify-center ${className}`}
      data-testid="win-badge"
    >
      {/* 트로피와 숫자를 한 덩어리로 묶는다 — 숫자 자리는 바깥 상자가 아니라
          트로피 기준이어야 한다. */}
      <span className="relative inline-flex">
        <svg viewBox={TROPHY_VIEWBOX} className="h-[1.55em] w-auto" aria-hidden>
          <defs>
            {gradientId === undefined && <TrophyGoldGradient id={goldId} />}
            {sheen && (
              <>
                <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                  <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>
                {/* 광택이 트로피 밖으로 삐져나오지 않게 모양대로 자른다. */}
                <clipPath id={clipId}>
                  <TrophyPaths />
                </clipPath>
              </>
            )}
          </defs>

          <g fill={`url(#${goldId})`}>
            <TrophyPaths />
          </g>

          {sheen && (
            <g clipPath={`url(#${clipId})`}>
              <rect
                className="trophy-sheen"
                style={
                  { '--sheen-start': `${-SHEEN_WIDTH}px`, '--sheen-end': '24px' } as React.CSSProperties
                }
                x={0}
                y={0}
                width={SHEEN_WIDTH}
                height={24}
                fill={`url(#${sheenId})`}
              />
            </g>
          )}
        </svg>

        {/* 트로피 몸통 아래쪽에 얹는다. 받침 위에서 멈춰서 받침은 그대로 보이고,
            숫자는 트로피 안쪽에 박힌 것처럼 읽힌다 — 더 내려가면 받침을 먹어
            트로피가 잘린 것처럼 보이고, 더 올라가면 컵을 덮어 작은 크기에서
            트로피인지 알아보기 어려워진다. */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 min-w-[1.15em] -translate-x-1/2 -translate-y-[26%] rounded-full px-[0.22em] text-center text-[0.72em] font-bold leading-[1.35] tabular-nums text-[#FFD365]"
          style={{ background: chipColor, boxShadow: `0 0 0 1px ${chipColor}` }}
        >
          {count}
        </span>
      </span>

      {/* 리더보드 물음표와 같은 말풍선이다 — 같은 성격의 안내는 같은 모양으로
          뜨는 편이 배울 것이 적다. 위로 펴는 이유도 같다: 아래로 펴면 표에서
          바로 다음 줄을 가린다. */}
      <span
        data-testid="win-badge-tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 px-3 py-2 text-xs leading-relaxed text-menu opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ background: TOOLTIP_BG }}
      >
        종합우승 <b className="font-bold text-foreground">{count}회</b>
      </span>

      <span className="sr-only">종합우승 {count}회</span>
    </span>
  );
}
