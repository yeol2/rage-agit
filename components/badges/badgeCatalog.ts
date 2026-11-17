/**
 * 뱃지 도감 — 이름·멘트·설명·그림을 한 곳에 모은다.
 *
 * 뱃지는 두 화면(리더보드·클랜원 상세)에 붙고 설명표도 같이 뜬다. 문구가
 * 화면마다 흩어지면 하나를 고칠 때 다른 하나가 남는다. **문구를 고치려면
 * 이 파일만 고치면 된다.**
 *
 * 우승 트로피 두 개(내전우승·꽃게들의 왕)는 횟수 숫자를 얹어야 해서 그림을
 * components/WinBadge.tsx 가 따로 들고 있다.
 */
export type TrophyKind = 'scrimWin' | 'crabKing';
export type BadgeKey = TrophyKind;

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
    description: '내전 종합 1등',
  },
  crabKing: {
    name: '꽃게들의 왕',
    quip: '내가 "킹" 크랩이다',
    description: '저티어 내전 종합 1등',
  },
};

