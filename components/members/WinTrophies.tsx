import type { CSSProperties } from 'react';
import { TROPHY_SIZE, TROPHY_X, TROPHY_Y, TrophyPaths } from '@/components/TrophyGlyph';
import { siteConfig } from '@/lib/siteConfig';

// 트로피를 늘어놓아 우승 횟수를 보여준다. 다만 시즌이 이어지면 횟수가 계속
// 늘어나므로 그림은 여기까지만 그리고, 그보다 많으면 옆의 숫자가 받는다.
const MAX_GLYPHS = 8;

// 트로피 한 칸 간격. 글리프 폭(18.8)에 여백을 조금 준 값이다.
const STEP = 21.5;

// 스쳐 지나가는 빛 띠의 폭. 좁을수록 날카롭게 반짝인다.
const SHEEN_WIDTH = 7;

export function WinTrophies({ count }: { count: number }) {
  // 우승이 없으면 아무것도 안 그린다 — 빈 자리를 "0회"로 채우면 6각형 지표
  // 위에 의미 없는 줄만 하나 늘어난다.
  if (count <= 0) return null;

  const { label } = siteConfig.memberDirectory.wins;
  const glyphs = Math.min(count, MAX_GLYPHS);
  const width = (glyphs - 1) * STEP + TROPHY_SIZE;

  const row = Array.from({ length: glyphs }, (_, i) => (
    <g key={i} transform={`translate(${i * STEP - TROPHY_X}, ${-TROPHY_Y})`}>
      <TrophyPaths />
    </g>
  ));

  // 광택 이동 거리는 트로피 개수에 따라 달라지므로 CSS 변수로 넘긴다.
  // svg 안에서 transform 의 px 는 사용자 좌표 단위와 같다.
  const sheenTravel = {
    '--sheen-start': `${-SHEEN_WIDTH}px`,
    '--sheen-end': `${width}px`,
  } as CSSProperties;

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-sm text-menu">
      {/* 트로피 전부를 svg 하나에 담는다. 낱개 svg 를 반복하면 gradient/clipPath
          id 가 문서에서 겹치고, 광택도 트로피마다 따로 놀아 한 줄로 훑고 가지
          않는다. 뜻은 옆의 글자가 이미 전하므로 그림은 읽어주지 않는다. */}
      <svg viewBox={`0 0 ${width} ${TROPHY_SIZE}`} className="h-[18px] w-auto" aria-hidden>
        <defs>
          {/* 황금색 — 위쪽이 밝고 아래로 갈수록 짙어져 금속처럼 보인다. */}
          <linearGradient id="win-trophy-gold" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#FFF1BE" />
            <stop offset="30%" stopColor="#FFD365" />
            <stop offset="62%" stopColor="#E8A62F" />
            <stop offset="100%" stopColor="#B0741A" />
          </linearGradient>

          <linearGradient id="win-trophy-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* 광택이 트로피 바깥으로 삐져나오지 않게 모양대로 자른다 */}
          <clipPath id="win-trophy-clip">{row}</clipPath>
        </defs>

        <g fill="url(#win-trophy-gold)">{row}</g>

        <g clipPath="url(#win-trophy-clip)">
          <rect
            className="trophy-sheen"
            style={sheenTravel}
            x={0}
            y={0}
            width={SHEEN_WIDTH}
            height={TROPHY_SIZE}
            fill="url(#win-trophy-sheen)"
          />
        </g>
      </svg>
      <span>{label(count)}</span>
    </p>
  );
}
