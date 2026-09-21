import type { ReactNode } from 'react';
import type { PlaystyleBadgeKind } from '@/lib/playstyleBadges';
import { BADGE_COPY, BADGE_IMAGE } from './badgeCatalog';
import { BadgeTooltip } from './BadgeTooltip';
import { HexFrame } from './HexFrame';

/**
 * 그림 한 장짜리 뱃지 — 얇은 육각 테두리 안에 그림, 올리면 설명표.
 */
export interface BadgePinProps {
  badge: PlaystyleBadgeKind;
  /** 뱃지 한 변(=육각형 높이). 글자 크기에 맞추려면 '2.2em' 같은 값도 된다. */
  size?: string;
  /** 설명표 맨 아래 줄 — 이 뱃지를 왜 받았는지. */
  detail?: ReactNode;
  /** 테두리 색 — 금·은·동을 여기서 말한다. */
  stroke?: string;
}

function Artwork({ badge, size, stroke }: { badge: PlaystyleBadgeKind; size: string; stroke?: string }) {
  return (
    <HexFrame size={size} stroke={stroke}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다 */}
      <img
        src={BADGE_IMAGE[badge]}
        alt=""
        aria-hidden="true"
        className="h-full w-full"
        style={{ objectFit: 'contain' }}
      />
    </HexFrame>
  );
}

export function BadgePin({ badge, size = '2.2em', detail, stroke }: BadgePinProps) {
  const copy = BADGE_COPY[badge];

  return (
    <span
      className="group relative inline-flex w-fit shrink-0 items-center justify-center"
      data-testid={`badge-pin-${badge}`}
    >
      <Artwork badge={badge} size={size} stroke={stroke} />

      <BadgeTooltip
        testId={`badge-tooltip-${badge}`}
        name={copy.name}
        description={copy.description}
        detail={detail}
        artwork={<Artwork badge={badge} size="3rem" stroke={stroke} />}
      />
    </span>
  );
}
