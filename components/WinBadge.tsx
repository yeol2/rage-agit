import type { ReactNode } from 'react';
import { BadgeTooltip } from '@/components/badges/BadgeTooltip';
import { BADGE_COPY } from '@/components/badges/badgeCatalog';
import { BADGE_SIZE, HexFrame } from '@/components/badges/HexFrame';

/**
 * 내전우승 뱃지 — 트로피 하나에 횟수를 숫자로 붙인다.
 *
 * 예전에는 횟수만큼 트로피를 늘어놓았다. 우승이 쌓일수록 가로로 길어져서 4위
 * 이하 표에서는 뱃지 칸을 넘겼고(모바일 48px 칸은 4개부터 잘린다), 그걸 막으려고
 * 화면 폭에 따라 두 벌을 그려두고 CSS 로 골라 보였다. 한 벌로 줄이면 폭이
 * 횟수와 무관하게 고정되고, 몇 번인지도 한눈에 읽힌다 — 트로피 여덟 개를 세는
 * 것보다 숫자 '8' 이 빠르다.
 *
 * 그림은 다른 뱃지와 같은 방식이다 — 배경을 지운 PNG 를 같은 육각 틀에 넣는다.
 * 트로피만 SVG 글리프로 그리던 때는 같은 줄에서 재질이 혼자 달라 보였다.
 */
export interface WinBadgeProps {
  count: number;
  /** 숫자 크기를 정하는 곳. 뱃지 자체 크기는 size 가 정한다. */
  className?: string;
  /** 우승이 0회일 때 대신 그릴 것. 표는 '-' 를 넣어 칸이 비어 보이지 않게 한다. */
  none?: ReactNode;
  /**
   * 숫자 뒤 알약 색. 뒤에 깔린 배경과 같아야 알약이 줄 위에 얹힌 것처럼 보인다.
   * 기본값은 카드·표 줄에 공통으로 쓰는 그래파이트다.
   */
  chipColor?: string;
  /** 뱃지 한 변. 다른 뱃지와 같은 값을 써야 한 줄에서 크기가 안 어긋난다. */
  size?: string;
}

const DEFAULT_CHIP_COLOR = '#1B1B23';

function Trophy() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다
    <img
      src="/badges/scrim-win.png"
      alt=""
      aria-hidden="true"
      data-testid="trophy-art"
      className="h-full w-full"
      style={{ objectFit: 'contain' }}
    />
  );
}

export function WinBadge({
  count,
  className = '',
  none = null,
  chipColor = DEFAULT_CHIP_COLOR,
  size = BADGE_SIZE,
}: WinBadgeProps) {
  if (count <= 0) return <>{none}</>;

  return (
    <span
      className={`group relative inline-flex w-fit shrink-0 items-center justify-center ${className}`}
      data-testid="win-badge"
    >
      {/* 횟수는 육각형 **맨 아래 꼭짓점**에 걸쳐 놓는다. 트로피 몸통 위에 얹으면
          그림 한가운데를 가려서 무엇인지 잘 안 보인다. */}
      <span className="relative inline-flex">
        <HexFrame size={size}>
          <Trophy />
        </HexFrame>

        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 min-w-[1.3em] -translate-x-1/2 translate-y-[38%] rounded-full px-[0.3em] text-center text-[0.68em] font-bold leading-[1.45] tabular-nums text-[#FFD365]"
          style={{ background: chipColor, boxShadow: `0 0 0 1px ${chipColor}` }}
        >
          {count}
        </span>
      </span>

      <BadgeTooltip
        testId="badge-tooltip-scrimWin"
        name={BADGE_COPY.scrimWin.name}
        quip={BADGE_COPY.scrimWin.quip}
        description={BADGE_COPY.scrimWin.description}
        statLine={`내전 종합 1위 ${count}회`}
        artwork={
          <HexFrame size="6rem">
            <Trophy />
          </HexFrame>
        }
      />
    </span>
  );
}
