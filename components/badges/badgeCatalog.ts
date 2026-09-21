import type { BadgeMedal, PlaystyleBadgeKind } from '@/lib/playstyleBadges';

/**
 * 뱃지 도감 — 이름·멘트·설명·그림을 한 곳에 모은다.
 *
 * 뱃지는 두 화면(리더보드·클랜원 상세)에 붙고 설명표도 같이 뜬다. 문구가
 * 화면마다 흩어지면 하나를 고칠 때 다른 하나가 남는다. **문구를 고치려면
 * 이 파일만 고치면 된다.**
 *
 * 내전우승 트로피만 그림이 SVG 라 여기 없다(components/TrophyGlyph.tsx) —
 * 횟수 숫자를 얹어야 해서 처음부터 벡터로 그렸다.
 */
export type BadgeKey = 'scrimWin' | PlaystyleBadgeKind;

export interface BadgeCopy {
  name: string;
  /** 이름 아래 한 줄 — 놀리는 말. */
  quip: string;
  /** 무슨 기준으로 주는 뱃지인지. 작은 회색 글씨로 깔린다. */
  description: string;
}

export const BADGE_COPY: Record<BadgeKey, BadgeCopy> = {
  scrimWin: {
    name: '내전 우승',
    quip: '오늘 저녁은 치킨이닭!',
    description: '내전에서 종합 1위를 한 횟수입니다.',
  },
  damageFarmer: {
    name: '딜딸의 신',
    quip: '딜은 내가 다 넣었는데 킬은 남이 가져갔닭',
    description:
      '같은 티어 그룹에서, 자기 킬 수로 기대되는 딜보다 경기당 가장 많이 더 넣은 세 명에게 줍니다.',
  },
  killFarmer: {
    name: '킬딸의 신',
    quip: '눕히는 건 팀원, 마무리는 내 몫이닭',
    description:
      '같은 티어 그룹에서, 자기 딜량으로 기대되는 킬보다 경기당 가장 많이 더 챙긴 세 명에게 줍니다.',
  },
};

/**
 * 그림은 메달마다 한 벌씩이다 — 테두리만 금은동이면 작은 크기(표에서 34px)에서
 * 그 선이 거의 안 보여 셋이 같은 뱃지로 읽힌다. 에나멜 색까지 바꾸면 멀리서도
 * 갈린다.
 */
const MEDAL_FILE: Record<BadgeMedal, string> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export function badgeImage(kind: PlaystyleBadgeKind, medal: BadgeMedal): string {
  const file = kind === 'damageFarmer' ? 'damage-farmer' : 'kill-farmer';
  return `/badges/${file}-${MEDAL_FILE[medal]}.png`;
}
