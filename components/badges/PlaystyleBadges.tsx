import type { PlaystyleBadgeHolder } from '@/lib/playstyleBadges';
import { BadgePin } from './BadgePin';

/**
 * 한 사람이 단 플레이 스타일 뱃지들.
 *
 * 설명표 맨 아랫줄에는 **왜 받았는지**를 적는다 — 어느 티어 그룹에서 1등인지,
 * 그리고 그 근거값. 값을 숨기면 "쟤가 왜?"에 답할 수가 없다.
 */
export function playstyleBadgeDetail(holder: PlaystyleBadgeHolder): string {
  const evidence =
    holder.kind === 'hollow'
      ? `기절 10번에 킬 ${(holder.value * 10).toFixed(1)}개`
      : `킬당 ${Math.round(holder.value)}딜`;
  return `${holder.groupLabel} 1위 · ${evidence}`;
}

export function PlaystyleBadges({
  holders,
  size = '1.7em',
}: {
  holders: PlaystyleBadgeHolder[];
  size?: string;
}) {
  if (holders.length === 0) return null;

  return (
    <>
      {holders.map((holder) => (
        <BadgePin
          key={holder.kind}
          badge={holder.kind}
          size={size}
          detail={playstyleBadgeDetail(holder)}
        />
      ))}
    </>
  );
}
