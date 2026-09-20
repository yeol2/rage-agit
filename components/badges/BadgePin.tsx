import type { ReactNode } from 'react';
import type { PlaystyleBadgeKind } from '@/lib/playstyleBadges';
import { BADGE_COPY, BADGE_IMAGE } from './badgeCatalog';
import { BadgeTooltip } from './BadgeTooltip';

/**
 * 뱃지 하나 — 아주 얇은 육각 테두리 안에 그림, 올리면 설명표.
 *
 * 테두리는 머리카락 두께다(어느 크기에서든 1px). 두꺼운 틀을 씌웠더니 22px
 * 칸에서 틀이 자리를 다 먹고 정작 그림이 안 보였다 — 틀은 "여기까지가 뱃지
 * 하나"만 말해주면 되고, 자리는 그림에 내준다.
 *
 * 그림은 육각형 폭의 72% 로 넣는다. 더 키우면 대각선 모서리에서 그림이 테두리를
 * 뚫고, 더 줄이면 틀만 큼직하고 그림이 작아진다.
 */
const HEX_POINTS = '50,1.5 93.5,26.2 93.5,73.8 50,98.5 6.5,73.8 6.5,26.2';

export interface BadgePinProps {
  badge: PlaystyleBadgeKind;
  /** 뱃지 한 변(=육각형 높이). 글자 크기에 맞추려면 '2em' 같은 값도 된다. */
  size?: string;
  /** 설명표 맨 아래 줄 — 이 뱃지를 왜 받았는지. */
  detail?: ReactNode;
}

export function BadgeArtwork({ badge, size }: { badge: PlaystyleBadgeKind; size: string }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ height: size, width: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* vectorEffect 덕분에 뱃지를 키워도 선은 1px 그대로다 — 작은 칸에서
            테두리가 굵어 보이지 않게 하려는 것. */}
        <polygon
          points={HEX_POINTS}
          fill="none"
          stroke="rgba(255,211,101,0.45)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다 */}
      <img
        src={BADGE_IMAGE[badge]}
        alt=""
        aria-hidden="true"
        className="relative"
        style={{ height: '72%', width: '72%', objectFit: 'contain' }}
      />
    </span>
  );
}

export function BadgePin({ badge, size = '2.2em', detail }: BadgePinProps) {
  const copy = BADGE_COPY[badge];

  return (
    <span
      className="group relative inline-flex w-fit shrink-0 items-center justify-center"
      data-testid={`badge-pin-${badge}`}
    >
      <BadgeArtwork badge={badge} size={size} />

      <BadgeTooltip
        testId={`badge-tooltip-${badge}`}
        name={copy.name}
        description={copy.description}
        detail={detail}
        artwork={<BadgeArtwork badge={badge} size="3rem" />}
      />
    </span>
  );
}
