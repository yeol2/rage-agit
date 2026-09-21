import type { ReactNode } from 'react';
import type { BadgeMedal, PlaystyleBadgeKind } from '@/lib/playstyleBadges';
import { BADGE_COPY, badgeImage } from './badgeCatalog';
import { BadgeTooltip } from './BadgeTooltip';
import { BADGE_SIZE, HexFrame } from './HexFrame';

/**
 * 그림 한 장짜리 뱃지 — 얇은 육각 테두리 안에 그림, 올리면 설명표.
 *
 * 금·은·동은 **그림과 테두리 양쪽**으로 말한다. 테두리만 바꾸면 작은 크기에서
 * 그 선이 거의 안 보여 셋이 같아 보인다.
 */
export interface BadgePinProps {
  badge: PlaystyleBadgeKind;
  medal: BadgeMedal;
  /** 뱃지 한 변(=육각형 높이). 기본값은 모든 뱃지가 공유하는 크기다. */
  size?: string;
  /** 설명표의 메달 줄 — "3~3.5티어 금메달". */
  medalLine?: ReactNode;
  /** 설명표 맨 아랫줄의 뚜렷한 수치. */
  statLine?: ReactNode;
}

/**
 * 테두리 — 그림과 같은 메달색이되 한 톤 밝게, 불투명하게 쓴다. 얇은 선이라
 * 그림과 같은 밝기로 두면 배경에 묻혀서 금은동이 안 읽힌다.
 * (시상대 트로피 배지색 #FFD365 / #CDCDCD / #B38A48 을 밝기만 올린 값)
 */
const MEDAL_STROKE: Record<BadgeMedal, string> = {
  1: '#FFE49A',
  2: '#E8E8E8',
  3: '#D8A85F',
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

export function BadgePin({ badge, medal, size = BADGE_SIZE, medalLine, statLine }: BadgePinProps) {
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
        quip={copy.quip}
        description={copy.description}
        medalLine={medalLine}
        statLine={statLine}
        artwork={<Artwork badge={badge} medal={medal} size="4.5rem" />}
      />
    </span>
  );
}
