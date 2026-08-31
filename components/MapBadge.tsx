'use client';

import type { MapBadge as MapBadgeData } from '@/lib/mapStats';

/**
 * 맵 뱃지 — "에란겔의 신", "태이고의 똥".
 *
 * 내전 네 맵마다 한 명씩만 나온다. 클랜 전체에서 여덟 자리뿐이라 희소하고,
 * 그래서 우승 트로피 옆에 나란히 놓아도 뱃지 줄이 길어지지 않는다.
 *
 * 우승 뱃지(components/WinBadge.tsx)와 같은 규칙을 따른다 — 크기는 바깥에서
 * 글자 크기로 정하고, 마우스를 올리면 리더보드 물음표와 같은 말풍선이 뜬다.
 */
const KIND_STYLE = {
  god: {
    emoji: '😇',
    title: (label: string) => `${label}의 신`,
    ring: 'rgba(255,222,158,0.55)',
    background: 'rgba(255,228,170,0.12)',
  },
  poop: {
    emoji: '💩',
    title: (label: string) => `${label}의 똥`,
    ring: 'rgba(190,140,90,0.5)',
    background: 'rgba(150,110,70,0.14)',
  },
} as const;

const TOOLTIP_BG = '#1B1B23';

export function MapBadge({ badge, className = '' }: { badge: MapBadgeData; className?: string }) {
  const style = KIND_STYLE[badge.kind];
  const title = style.title(badge.label);

  return (
    <span
      className={`group relative inline-flex w-fit shrink-0 items-center justify-center ${className}`}
      data-testid={`map-badge-${badge.mapName}-${badge.kind}`}
    >
      {/* 맵 이름 첫 글자를 둥근 칩에 담는다. 네 맵의 첫 글자가 론·에·미·태로
          서로 달라서 한 글자만으로 구분된다. */}
      <span
        aria-hidden="true"
        className="flex h-[1.55em] w-[1.55em] items-center justify-center rounded-full text-[0.72em] font-bold leading-none"
        style={{ background: style.background, boxShadow: `0 0 0 1px ${style.ring}` }}
      >
        {badge.label.slice(0, 1)}
      </span>

      {/* 종류(신/똥)는 칩 아래 모서리에 작게 얹는다 — 우승 뱃지의 숫자와 같은
          자리라 뱃지들이 한 줄에 섞여도 눈이 같은 곳을 본다. */}
      <span
        aria-hidden="true"
        className="absolute -bottom-[0.15em] -right-[0.15em] text-[0.62em] leading-none"
      >
        {style.emoji}
      </span>

      <span
        data-testid="map-badge-tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 px-3 py-2 text-xs leading-relaxed text-menu opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ background: TOOLTIP_BG }}
      >
        <b className="font-bold text-foreground">{title}</b>
        <br />
        {badge.games}경기 평균 {badge.avgRank.toFixed(1)}등 · 다른 맵{' '}
        {badge.otherAvgRank.toFixed(1)}등
      </span>

      <span className="sr-only">{title}</span>
    </span>
  );
}
