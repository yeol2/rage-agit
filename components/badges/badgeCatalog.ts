import type { BadgeMedal, PlaystyleBadgeKind } from '@/lib/playstyleBadges';

/**
 * 뱃지 도감 — 이름·설명·그림을 한 곳에 모은다.
 *
 * 뱃지는 두 화면(리더보드·클랜원 상세)에 붙고 설명표도 같이 뜬다. 문구가
 * 화면마다 흩어지면 하나를 고칠 때 다른 하나가 남는다.
 *
 * 내전우승 트로피만 그림이 SVG 라 여기 없다(components/TrophyGlyph.tsx) —
 * 횟수 숫자를 얹어야 해서 처음부터 벡터로 그렸다.
 */
export type BadgeKey = 'scrimWin' | PlaystyleBadgeKind;

export interface BadgeCopy {
  name: string;
  /** 설명표 두 번째 줄. 뜻을 풀어 쓰되 놀리는 말투는 그대로 둔다. */
  description: string;
}

export const BADGE_COPY: Record<BadgeKey, BadgeCopy> = {
  scrimWin: {
    name: '내전 우승',
    description: '오늘 저녁은 치킨이닭!',
  },
  damageFarmer: {
    name: '최강 딜딸러',
    description: '딜은 내가 다 넣었는데 킬은 남이 가져갔닭',
  },
  killFarmer: {
    name: '최강 킬딸러',
    description: '눕히는 건 팀원, 마무리는 내 몫이닭',
  },
};

/**
 * 그림은 메달마다 한 벌씩이다 — 테두리만 금은동이면 작은 크기(표에서 30px)에서
 * 그 선이 거의 안 보여 셋이 같은 뱃지로 읽힌다. 에나멜 색까지 바꾸면 멀리서도
 * 갈린다.
 */
const MEDAL_FILE: Record<BadgeMedal, string> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export function badgeImage(kind: PlaystyleBadgeKind, medal: BadgeMedal): string {
  const file = kind === 'damageFarmer' ? 'damage-farmer' : 'kill-farmer';
  return `/badges/${file}-${MEDAL_FILE[medal]}.png`;
}
