import type { ReactNode } from 'react';
import { BadgePin } from '@/components/badges/BadgePin';

/**
 * 내전우승 뱃지 — 육각 핀 하나에 횟수를 숫자로 겹쳐 얹는다.
 *
 * 예전에는 횟수만큼 트로피를 늘어놓았다. 우승이 쌓일수록 가로로 길어져서 4위
 * 이하 표에서는 뱃지 칸을 넘겼고, 그걸 막으려고 화면 폭에 따라 두 벌을 그려두고
 * CSS 로 골라 보였다. 한 벌로 줄이면 폭이 횟수와 무관하게 고정되고, 몇 번인지도
 * 한눈에 읽힌다 — 트로피 여덟 개를 세는 것보다 숫자 '8' 이 빠르다.
 *
 * 그림은 다른 뱃지들과 같은 육각 핀이다(components/badges/badgeCatalog.ts).
 * 트로피만 홀로 다른 모양이면 뱃지 칸에서 혼자 튄다.
 *
 * 크기는 바깥에서 글자 크기(className 의 text-*)로 정한다 — 핀 높이가 em 이라
 * 글자 크기를 바꾸면 핀과 숫자가 같은 비율로 커진다.
 */
export interface WinBadgeProps {
  count: number;
  /** 크기를 정하는 곳. text-* 하나면 핀과 숫자가 같이 커진다. */
  className?: string;
  /** 우승이 0회일 때 대신 그릴 것. 표는 '-' 를 넣어 칸이 비어 보이지 않게 한다. */
  none?: ReactNode;
  /**
   * 숫자 뒤 알약 색. 뒤에 깔린 배경과 같아야 핀 위에 박힌 것처럼 보인다.
   * 기본값은 카드·표 줄에 공통으로 쓰는 그래파이트다.
   */
  chipColor?: string;
}

const DEFAULT_CHIP_COLOR = '#1B1B23';

export function WinBadge({
  count,
  className = '',
  none = null,
  chipColor = DEFAULT_CHIP_COLOR,
}: WinBadgeProps) {
  if (count <= 0) return <>{none}</>;

  return (
    <span className={`inline-flex w-fit shrink-0 ${className}`} data-testid="win-badge">
      <BadgePin
        badge="scrimWin"
        size="1.7em"
        detail={`내전 종합 1위 ${count}회`}
        overlay={
          // 핀 아래쪽에 얹는다. 육각 틀의 아래 꼭짓점 위에서 멈춰서 틀은 그대로
          // 보이고, 숫자는 핀 안에 박힌 것처럼 읽힌다.
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 min-w-[1.15em] -translate-x-1/2 -translate-y-[18%] rounded-full px-[0.22em] text-center text-[0.72em] font-bold leading-[1.35] tabular-nums text-[#FFD365]"
            style={{ background: chipColor, boxShadow: `0 0 0 1px ${chipColor}` }}
          >
            {count}
          </span>
        }
      />
    </span>
  );
}
