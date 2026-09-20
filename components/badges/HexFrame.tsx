import type { ReactNode } from 'react';

/**
 * 뱃지를 두르는 얇은 육각 테두리 — 모든 뱃지가 같은 틀을 쓴다.
 *
 * 선은 머리카락 두께다. 두꺼운 틀을 씌웠더니 22px 칸에서 틀이 자리를 다 먹고
 * 정작 그림이 안 보였다 — 틀은 "여기까지가 뱃지 하나"만 말해주면 되고, 자리는
 * 그림에 내준다. vectorEffect 덕분에 뱃지를 키워도 선은 1px 그대로다.
 *
 * 안쪽 그림은 육각형의 72% 로 넣는다. 더 키우면 대각선 모서리에서 그림이
 * 테두리를 뚫고, 더 줄이면 틀만 큼직하고 그림이 작아진다.
 */
const HEX_POINTS = '50,1.5 93.5,26.2 93.5,73.8 50,98.5 6.5,73.8 6.5,26.2';

export const HEX_INNER_RATIO = '72%';

export function HexFrame({ size, children }: { size: string; children: ReactNode }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ height: size, width: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <polygon
          points={HEX_POINTS}
          fill="none"
          stroke="rgba(255,211,101,0.45)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="relative inline-flex items-center justify-center"
        style={{ height: HEX_INNER_RATIO, width: HEX_INNER_RATIO }}
      >
        {children}
      </span>
    </span>
  );
}
