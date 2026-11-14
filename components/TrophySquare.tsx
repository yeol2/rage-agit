import { TROPHY_VIEWBOX, TrophyPaths } from '@/components/TrophyGlyph';

// 1~3등 금·은·동 트로피 배지(둥근 사각 + 트로피 글리프). 리더보드 시상대와
// 명예의 전당이 같은 것을 쓴다 — 예전엔 TierRankingPodium 안에만 있었다.
//
// 1등 금색은 사용자가 지정한 #FFD365, 2·3등은 같은 배지를 은/동으로 낮춘 것.
export const TROPHY_COLORS: Record<1 | 2 | 3, { bg: string; icon: string }> = {
  1: { bg: '#FFD365', icon: '#5A4413' },
  2: { bg: '#CDCDCD', icon: '#44464A' },
  3: { bg: '#B38A48', icon: '#3F2D11' },
};

const SIZES = {
  // 리더보드 시상대 — 박스 윗면·정면 경계에 절반 걸치는 큰 배지.
  lg: { box: 'h-10 w-10 rounded-xl sm:h-11 sm:w-11', icon: 'h-5 w-5 sm:h-[22px] sm:w-[22px]' },
  // 명예의 전당 표 한 줄 — 등수 칸에 들어가는 작은 배지.
  sm: { box: 'h-7 w-7 rounded-lg', icon: 'h-4 w-4' },
} as const;

export function TrophySquare({ rank, size = 'lg' }: { rank: 1 | 2 | 3; size?: keyof typeof SIZES }) {
  const { bg, icon } = TROPHY_COLORS[rank];
  const s = SIZES[size];
  return (
    <span
      className={`flex items-center justify-center ${s.box}`}
      style={{ background: bg, boxShadow: '0 8px 20px 0 rgba(0, 0, 0, 0.35)' }}
    >
      <svg viewBox={TROPHY_VIEWBOX} fill={icon} className={s.icon}>
        <TrophyPaths />
      </svg>
    </span>
  );
}
