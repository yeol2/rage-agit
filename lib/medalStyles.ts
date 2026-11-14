// 1~3등 금·은·동 박스 스타일. 내전 기록(한 경기 1~3위 팀 박스)과 명예의 전당(기록
// 1~3등 줄)이 같은 양식을 쓴다 — 예전엔 ScrimSessionRow 안에만 있었다.
//
// 은·동은 리더보드 트로피 배지(components/TrophySquare 의 TROPHY_COLORS)와 같은
// #CDCDCD · #B38A48 이고, 금만 리더보드의 #FFD365 보다 밝고 노란 #FFE04D 다 — 동색
// (#B38A48)이 황갈색이라 금이 조금만 어두워도 둘이 같은 색으로 읽힌다. 테두리·배경
// 모두 같은 값을 쓰고 밝기만 알파로 달리한다.

export type Medal = 1 | 2 | 3;

export function medalOf(rank: number): Medal | null {
  return rank === 1 || rank === 2 || rank === 3 ? rank : null;
}

export const MEDAL_BORDER: Record<Medal, string> = {
  1: 'border-[rgba(255,224,77,0.7)]',
  2: 'border-[rgba(205,205,205,0.5)]',
  3: 'border-[rgba(179,138,72,0.6)]',
};

/** 위가 진하고 아래로 옅어지는 세로 그라데이션. */
export const MEDAL_GRADIENT: Record<Medal, string> = {
  1: 'bg-[linear-gradient(180deg,rgba(255,224,77,0.2),rgba(255,224,77,0.04))]',
  2: 'bg-[linear-gradient(180deg,rgba(205,205,205,0.14),rgba(205,205,205,0.03))]',
  3: 'bg-[linear-gradient(180deg,rgba(179,138,72,0.16),rgba(179,138,72,0.03))]',
};

// 등수 글자 자리(내전 기록). 글자색은 리더보드 배지의 트로피 글리프 색 그대로다.
export const MEDAL_BADGE: Record<Medal, string> = {
  1: 'bg-[#FFE04D] text-[#5A4413]',
  2: 'bg-[#CDCDCD] text-[#44464A]',
  3: 'bg-[#B38A48] text-[#3F2D11]',
};
