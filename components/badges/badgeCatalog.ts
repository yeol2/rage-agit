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
    description: '내전 종합 1위',
  },
  damageFarmer: {
    name: '딜딸의 신',
    quip: '나 탄좀 줄래? 구상이랑 드링크도 주면 좋고',
    description: '같은 티어에서 킬 대비 딜이 가장 많은 사람',
  },
  killFarmer: {
    name: '킬딸의 신',
    quip: '어~ 눕히느라 고생했고 확킬은 내가 먹을게',
    description: '같은 티어에서 딜 대비 킬이 가장 많은 사람',
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
