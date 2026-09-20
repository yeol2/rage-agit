import type { PlaystyleBadgeKind } from '@/lib/playstyleBadges';

/**
 * 뱃지 도감 — 이름·설명을 한 곳에 모은다.
 *
 * 뱃지는 두 화면(리더보드·클랜원 상세)에 붙고 설명표도 같이 뜬다. 문구가
 * 화면마다 흩어지면 하나를 고칠 때 다른 하나가 남는다.
 *
 * 그림은 뱃지마다 종류가 다르다 — 플레이 스타일 뱃지는 핀 사진(PNG, public/badges),
 * 내전우승은 트로피 글리프(SVG, components/TrophyGlyph.tsx)다. 그래서 그림은
 * 여기 모으지 않고 각자 자기 컴포넌트가 그린다. 틀(육각형 같은 것)은 씌우지
 * 않는다 — 22px 칸에서는 틀이 자리를 다 먹어 정작 그림이 안 보인다.
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
  hollow: {
    name: '실속 없는 사람',
    description: '밑 빠진 독에 기절 붓기',
  },
};

/** 그림이 PNG 인 뱃지들(플레이 스타일 3종). */
export const BADGE_IMAGE: Record<PlaystyleBadgeKind, string> = {
  damageFarmer: '/badges/damage-farmer.png',
  killFarmer: '/badges/kill-farmer.png',
  hollow: '/badges/hollow.png',
};
