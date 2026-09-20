import type { PlaystyleBadgeKind } from '@/lib/playstyleBadges';

/**
 * 뱃지 도감 — 그림·이름·설명을 한 곳에 모은다.
 *
 * 뱃지는 두 화면(리더보드·클랜원 상세)에 붙고 설명표도 같이 뜬다. 문구가
 * 화면마다 흩어지면 하나를 고칠 때 다른 하나가 남는다.
 *
 * 그림은 실물 에나멜 핀 사진을 딴 PNG 다(public/badges). 전부 같은 육각 핀
 * 틀이라 나란히 놓으면 한 식구로 읽힌다 — 내전우승 트로피도 같은 틀에
 * 들어가 있다.
 */
export type BadgeKey = 'scrimWin' | PlaystyleBadgeKind;

export interface BadgeArt {
  name: string;
  /** 설명표 두 번째 줄. 뜻을 풀어 쓰되 놀리는 말투는 그대로 둔다. */
  description: string;
  src: string;
}

export const BADGE_ART: Record<BadgeKey, BadgeArt> = {
  scrimWin: {
    name: '내전 우승',
    description: '오늘 저녁은 치킨이닭!',
    src: '/badges/scrim-win.png',
  },
  damageFarmer: {
    name: '최강 딜딸러',
    description: '딜은 내가 다 넣었는데 킬은 남이 가져갔닭',
    src: '/badges/damage-farmer.png',
  },
  killFarmer: {
    name: '최강 킬딸러',
    description: '눕히는 건 팀원, 마무리는 내 몫이닭',
    src: '/badges/kill-farmer.png',
  },
  hollow: {
    name: '실속 없는 사람',
    description: '밑 빠진 독에 기절 붓기',
    src: '/badges/hollow.png',
  },
};
