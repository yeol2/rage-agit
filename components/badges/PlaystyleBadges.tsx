import type { ReactNode } from 'react';
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
 * 뚜렷한 수치 한 줄 — "킬 하나 따는 데 딜을 얼마나 쓰는가"를 티어 평균과 나란히
 * 놓는다.
 *
 * 뱃지를 준 계산 자체는 경기당 초과분인데, 그 숫자는 한 번 더 설명해야 뜻이
 * 통한다. 킬당 딜량은 자기 전적으로 바로 검산되고, 평균보다 많이 쓰면 딜딸,
 * 적게 쓰면 킬딸이라는 것도 그 줄에서 바로 읽힌다.
 */
export function playstyleStatLine(holder: PlaystyleBadgeHolder): ReactNode {
  const mine = Math.round(holder.damagePerKill);
  const base = Math.round(holder.groupDamagePerKill);
  const gap = Math.abs(mine - base);
  const direction = holder.kind === 'damageFarmer' ? '더 씁니다' : '적게 씁니다';

  return (
    <>
      {/* 숫자를 먼저 한 줄로 보여주고, 그게 무슨 뜻인지는 아랫줄에서 푼다. */}
      <span className="block font-bold text-foreground">1킬 당 {mine}딜</span>
      <span className="block">
        티어 평균(1킬당 {base}딜)보다 {gap}딜 {direction}
      </span>
    </>
  );
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
