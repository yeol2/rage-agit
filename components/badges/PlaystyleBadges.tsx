import type { BadgeMedal, PlaystyleBadgeHolder } from '@/lib/playstyleBadges';
import { BadgePin } from './BadgePin';

/**
 * 한 사람이 단 플레이 스타일 뱃지들.
 *
 * 뱃지마다 티어 그룹에서 금·은·동 세 명뿐이라, 메달은 **그림과 테두리 색**이
 * 같이 말한다(내전우승 트로피·리더보드 시상대가 쓰는 금·은·동과 같은 색).
 *
 * 설명표 맨 아랫줄에는 **왜 받았는지**를 적는다 — 어느 구간에서 몇 등인지,
 * 그리고 기준선에서 얼마나 벗어났는지. 값을 숨기면 "쟤가 왜?"에 답할 수가 없다.
 */
const MEDAL_LABEL: Record<BadgeMedal, string> = { 1: '금메달', 2: '은메달', 3: '동메달' };

export function playstyleBadgeDetail(holder: PlaystyleBadgeHolder): string {
  const evidence =
    holder.kind === 'damageFarmer'
      ? `기대보다 경기당 +${Math.round(holder.value)}딜`
      : `기대보다 경기당 +${holder.value.toFixed(2)}킬`;
  return `${holder.groupLabel} ${MEDAL_LABEL[holder.medal]} · ${evidence}`;
}

export function PlaystyleBadges({
  holders,
  size = '2.2em',
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
          medal={holder.medal}
          size={size}
          detail={playstyleBadgeDetail(holder)}
        />
      ))}
    </>
  );
}
