import type { BadgeMedal, PlaystyleBadgeHolder } from '@/lib/playstyleBadges';
import { BadgePin } from './BadgePin';
import { BADGE_SIZE } from './HexFrame';

/**
 * 한 사람이 단 플레이 스타일 뱃지들.
 *
 * 뱃지마다 티어 그룹에서 금·은·동 세 명뿐이라, 메달은 **그림과 테두리 색**이
 * 같이 말한다(내전우승 트로피·리더보드 시상대가 쓰는 금·은·동과 같은 색).
 *
 * 설명표 아래 두 줄은 **어느 무대에서 몇 등인지**와 **왜 받았는지**다. 값을
 * 숨기면 "쟤가 왜?"에 답할 수가 없다.
 */
const MEDAL_LABEL: Record<BadgeMedal, string> = { 1: '금메달', 2: '은메달', 3: '동메달' };

export function playstyleMedalLine(holder: PlaystyleBadgeHolder): string {
  return `${holder.groupLabel} ${MEDAL_LABEL[holder.medal]}`;
}

/**
 * 뚜렷한 수치 한 줄.
 *
 * 킬당 데미지를 그룹 기준선과 나란히 보여준다 — 뱃지를 준 계산 자체(경기당
 * 초과분)는 한눈에 안 들어오지만, "킬 하나에 몇 딜 쓰는 사람인가"는 자기
 * 전적으로 바로 검산된다. 뒤에 실제 계산값을 덧붙인다.
 */
export function playstyleStatLine(holder: PlaystyleBadgeHolder): string {
  const mine = Math.round(holder.damagePerKill);
  const base = Math.round(holder.groupDamagePerKill);
  const extra =
    holder.kind === 'damageFarmer'
      ? `경기당 +${Math.round(holder.value)}딜`
      : `경기당 +${holder.value.toFixed(2)}킬`;
  return `킬당 데미지 ${mine} (그룹 평균 ${base}) · 기대보다 ${extra}`;
}

export function PlaystyleBadges({
  holders,
  size = BADGE_SIZE,
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
          medalLine={playstyleMedalLine(holder)}
          statLine={playstyleStatLine(holder)}
        />
      ))}
    </>
  );
}
