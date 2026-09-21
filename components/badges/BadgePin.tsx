import type { ReactNode } from 'react';
import type { BadgeMedal, PlaystyleBadgeKind } from '@/lib/playstyleBadges';
import { BADGE_COPY, badgeImage } from './badgeCatalog';
import { BadgeTooltip } from './BadgeTooltip';
import { HexFrame } from './HexFrame';

/**
 * 그림 한 장짜리 뱃지 — 얇은 육각 테두리 안에 그림, 올리면 설명표.
 *
 * 금·은·동은 **그림과 테두리 양쪽**으로 말한다. 테두리만 바꾸면 작은 크기에서
 * 그 선이 거의 안 보여 셋이 같아 보인다.
 */
export interface BadgePinProps {
  badge: PlaystyleBadgeKind;
  medal: BadgeMedal;
  /** 뱃지 한 변(=육각형 높이). 글자 크기에 맞추려면 '2.2em' 같은 값도 된다. */
  size?: string;
  /** 설명표 맨 아래 줄 — 이 뱃지를 왜 받았는지. */
  detail?: ReactNode;
}

const MEDAL_STROKE: Record<BadgeMedal, string> = {
  1: 'rgba(255,211,101,0.8)',
  2: 'rgba(205,205,205,0.75)',
  3: 'rgba(179,138,72,0.85)',
};

function Artwork({
  badge,
  medal,
  size,
}: {
  badge: PlaystyleBadgeKind;
  medal: BadgeMedal;
  size: string;
}) {
  return (
    <HexFrame size={size} stroke={MEDAL_STROKE[medal]}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다 */}
      <img
        src={badgeImage(badge, medal)}
        alt=""
        aria-hidden="true"
        className="h-full w-full"
        style={{ objectFit: 'contain' }}
      />
    </HexFrame>
  );
}

export function BadgePin({ badge, medal, size = '2.2em', detail }: BadgePinProps) {
  const copy = BADGE_COPY[badge];

  return (
    <span
      className="group relative inline-flex w-fit shrink-0 items-center justify-center"
      data-testid={`badge-pin-${badge}`}
    >
      <Artwork badge={badge} medal={medal} size={size} />

      <BadgeTooltip
        testId={`badge-tooltip-${badge}`}
        name={copy.name}
        description={copy.description}
        detail={detail}
        artwork={<Artwork badge={badge} medal={medal} size="3rem" />}
      />
    </span>
  );
}
