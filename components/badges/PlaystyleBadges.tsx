import type { BadgeMedal, PlaystyleBadgeHolder } from '@/lib/playstyleBadges';
import { BadgePin } from './BadgePin';

/**
 * 한 사람이 단 플레이 스타일 뱃지들.
 *
 * 뱃지마다 클랜 전체에서 금·은·동 세 명뿐이라, **메달은 테두리 색**으로 말한다
 * (내전우승 트로피·리더보드 시상대가 쓰는 금·은·동과 같은 색). 그림을 메달마다
 * 따로 만들면 같은 뱃지가 셋으로 보인다.
 *
 * 설명표 맨 아랫줄에는 **왜 받았는지**를 적는다 — 몇 등인지, 그리고 기준선에서
 * 얼마나 벗어났는지. 값을 숨기면 "쟤가 왜?"에 답할 수가 없다.
 */
export const MEDAL_STROKE: Record<BadgeMedal, string> = {
  1: 'rgba(255,211,101,0.8)',
  2: 'rgba(205,205,205,0.75)',
  3: 'rgba(179,138,72,0.85)',
};

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
          size={size}
          stroke={MEDAL_STROKE[holder.medal]}
          detail={playstyleBadgeDetail(holder)}
        />
      ))}
    </>
  );
}
