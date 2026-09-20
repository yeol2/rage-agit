import type { PlaystyleBadgeHolder, PlaystyleBadgeKind } from '@/lib/playstyleBadges';

/**
 * 플레이 스타일 뱃지 하나.
 *
 * 내전우승 뱃지(WinBadge)와 달리 **글자가 본체**다. 이 뱃지는 기록이 아니라
 * 별명이라, 그림만 있으면 무슨 별명인지 알 수 없다. 그래서 넓은 자리에서는
 * 이름을 그대로 적고(size="md"), 리더보드 표처럼 칸이 좁은 자리에서만 그림으로
 * 줄인다(size="sm") — 거기서는 title 로 이름이 뜬다.
 */
const BADGE_LABEL: Record<PlaystyleBadgeKind, string> = {
  damageFarmer: '최강 딜딸러',
  killFarmer: '최강 킬딸러',
  hollow: '실속 없는 사람',
};

const BADGE_GLYPH: Record<PlaystyleBadgeKind, string> = {
  damageFarmer: '💥',
  killFarmer: '🔪',
  hollow: '😵',
};

// 뱃지마다 색이 다른 이유는 하나다 — 표에서 여러 줄에 뱃지가 깔렸을 때 어느
// 별명인지 그림을 뜯어보지 않고도 갈리게 하려는 것. 메달색(금·은·동)은 피했다.
const BADGE_COLOR: Record<PlaystyleBadgeKind, string> = {
  damageFarmer: 'border-[rgba(255,122,69,0.5)] text-[#FF9E6B]',
  killFarmer: 'border-[rgba(255,86,86,0.5)] text-[#FF8A8A]',
  hollow: 'border-[rgba(150,150,170,0.45)] text-[#B9B9CA]',
};

/** 뱃지를 준 근거를 사람 말로. 말풍선(title)에 이름과 함께 붙는다. */
export function badgeReason(holder: PlaystyleBadgeHolder): string {
  if (holder.kind === 'hollow') {
    return `기절 10번에 킬 ${(holder.value * 10).toFixed(1)}개`;
  }
  return `킬당 ${Math.round(holder.value)}딜`;
}

export interface PlaystyleBadgeChipProps {
  holder: PlaystyleBadgeHolder;
  /** md = 이름까지 적는다(기본), sm = 그림만. */
  size?: 'sm' | 'md';
}

export function PlaystyleBadgeChip({ holder, size = 'md' }: PlaystyleBadgeChipProps) {
  const label = BADGE_LABEL[holder.kind];
  const title = `${label} · ${badgeReason(holder)}`;

  if (size === 'sm') {
    return (
      <span
        title={title}
        className={`flex h-6 w-6 items-center justify-center rounded-md border text-[13px] leading-none ${BADGE_COLOR[holder.kind]}`}
      >
        <span aria-hidden="true">{BADGE_GLYPH[holder.kind]}</span>
        <span className="sr-only">{title}</span>
      </span>
    );
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${BADGE_COLOR[holder.kind]}`}
    >
      <span aria-hidden="true">{BADGE_GLYPH[holder.kind]}</span>
      {label}
      <span className="font-semibold text-menu">{badgeReason(holder)}</span>
    </span>
  );
}

/** 한 사람이 단 뱃지 전부. 없으면 아무것도 안 그린다. */
export function PlaystyleBadges({
  holders,
  size = 'md',
}: {
  holders: PlaystyleBadgeHolder[];
  size?: 'sm' | 'md';
}) {
  if (holders.length === 0) return null;

  return (
    <span className={size === 'sm' ? 'flex items-center gap-1' : 'flex flex-wrap justify-center gap-2'}>
      {holders.map((holder) => (
        <PlaystyleBadgeChip key={holder.kind} holder={holder} size={size} />
      ))}
    </span>
  );
}
