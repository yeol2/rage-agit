import type { ReactNode } from 'react';
import type { PlaystyleBadgeKind } from '@/lib/playstyleBadges';
import { BADGE_COPY, BADGE_IMAGE } from './badgeCatalog';
import { BadgeTooltip } from './BadgeTooltip';

/**
 * 그림 한 장짜리 뱃지 — 마우스를 올리면 설명표가 위로 뜬다.
 *
 * 틀(육각형 같은 것)은 씌우지 않는다. 뱃지 그림 자체가 이미 한 덩어리라,
 * 바깥에 틀을 한 겹 더 두르면 22px 짜리 칸에서 정작 그림이 작아져 안 보인다.
 */
export interface BadgePinProps {
  badge: PlaystyleBadgeKind;
  /** 뱃지 크기. 글자 크기에 맞추고 싶으면 '1.7em' 같은 값도 된다. */
  size?: string;
  /** 설명표 맨 아래 줄 — 이 뱃지를 왜 받았는지. */
  detail?: ReactNode;
}

export function BadgePin({ badge, size = '1.7em', detail }: BadgePinProps) {
  const copy = BADGE_COPY[badge];
  const src = BADGE_IMAGE[badge];

  return (
    <span
      className="group relative inline-flex w-fit shrink-0 items-center justify-center"
      data-testid={`badge-pin-${badge}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다 */}
      <img src={src} alt="" aria-hidden="true" style={{ height: size, width: 'auto' }} />

      <BadgeTooltip
        testId={`badge-tooltip-${badge}`}
        name={copy.name}
        description={copy.description}
        detail={detail}
        artwork={
          // eslint-disable-next-line @next/next/no-img-element -- 위와 같은 이유
          <img src={src} alt="" aria-hidden="true" className="h-12 w-12" />
        }
      />
    </span>
  );
}
