import type { HexagonAxis } from '@/lib/memberStats';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 90;
const AXIS_COUNT = 6;
const GRID_RINGS = [0.25, 0.5, 0.75, 1];

// 우리 사이트의 foreground 색(순백)을 그대로 쓴다 — 새 색을 만들지 않는다.
// 기존 0.08 은 거의 안 보일 만큼 어두웠다.
const GRID_COLOR = 'rgba(255,255,255,0.35)';

// index 0 이 12시 방향에서 시작해 시계방향으로 6등분한다.
export function pointFor(index: number, fraction: number): [number, number] {
  const angle = (Math.PI * 2 * index) / AXIS_COUNT - Math.PI / 2;
  const r = RADIUS * fraction;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export function polygonPoints(fractions: number[]): string {
  return fractions.map((fraction, index) => pointFor(index, fraction).join(',')).join(' ');
}

export function Hexagon({ axes }: { axes: HexagonAxis[] }) {
  const fractions = axes.map((axis) => axis.percentile / 100);
  const averageFractions = axes.map((axis) => axis.averagePercentile / 100);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="6각형 지표" className="w-full max-w-xs">
      {GRID_RINGS.map((ring) => (
        <polygon
          key={ring}
          data-testid="hexagon-grid-ring"
          points={polygonPoints(Array(AXIS_COUNT).fill(ring))}
          fill="none"
          stroke={GRID_COLOR}
        />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = pointFor(index, 1);
        return (
          <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={GRID_COLOR} />
        );
      })}
      {/* 코호트 평균 — 점선. 본인 도형 아래 깔아서 실선이 항상 위에 보이게 한다. */}
      <polygon
        data-testid="hexagon-average"
        points={polygonPoints(averageFractions)}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        opacity={0.85}
      />
      {/* 본인 — 실선. */}
      <polygon
        data-testid="hexagon-self"
        points={polygonPoints(fractions)}
        fill="rgba(255,146,51,0.25)"
        stroke="#FF9233"
        strokeWidth={2}
      />
      {axes.map((axis, index) => {
        const [x, y] = pointFor(index, 1.2);
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fill="#A0A0A2"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}
