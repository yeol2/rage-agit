'use client';

import { useState } from 'react';
import { HEXAGON_AVERAGE_PERCENT, type HexagonAxis } from '@/lib/memberStats';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 90;
const AXIS_COUNT = 6;
const GRID_RINGS = [0.25, 0.5, 0.75, 1];

// 우리 사이트의 foreground 색(순백)을 그대로 쓴다 — 새 색을 만들지 않는다.
// 기존 0.08 은 거의 안 보일 만큼 어두웠다.
const GRID_COLOR = 'rgba(255,255,255,0.35)';

const SELF_COLOR = '#FF9233';
const AVERAGE_COLOR = '#FFFFFF';

// 두 도형은 **같은 굵기**여야 한다. 예전엔 본인이 2, 평균이 1.5 라 평균선이
// 실제보다 뒤로 물러나 보였고, 그러면 어느 쪽이 더 바깥인지를 굵기가 흐린다.
const STROKE_WIDTH = 2;

// index 0 이 12시 방향에서 시작해 시계방향으로 6등분한다.
// index 는 정수가 아니어도 된다 — 축 사이(예: 0.5)를 가리키면 두 축의 중간
// 방향이 나오고, 마우스를 받는 부채꼴을 그 방향들로 만든다.
export function pointFor(index: number, fraction: number): [number, number] {
  const angle = (Math.PI * 2 * index) / AXIS_COUNT - Math.PI / 2;
  const r = RADIUS * fraction;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export function polygonPoints(fractions: number[]): string {
  return fractions.map((fraction, index) => pointFor(index, fraction).join(',')).join(' ');
}

// 축 하나가 마우스를 받는 영역. 가운데에서 그 축 좌우 30° 씩, 라벨 바깥까지.
function wedgePoints(index: number): string {
  return [
    [CENTER, CENTER],
    pointFor(index - 0.5, 1.35),
    pointFor(index, 1.35),
    pointFor(index + 0.5, 1.35),
  ]
    .map((point) => point.join(','))
    .join(' ');
}

// 툴팁이 어느 쪽으로 자랄지. 축이 가리키는 바깥 방향으로 밀어내야 라벨과
// 도형을 안 덮는다 — 전부 가운데 정렬로 두면 옆 축들에서 라벨 위에 얹힌다.
// 순서는 12시부터 시계방향(pointFor 와 같다).
const TOOLTIP_PLACEMENT: Array<{ radius: number; transform: string }> = [
  { radius: 1.34, transform: 'translate(-50%, -100%)' }, // 위
  { radius: 1.28, transform: 'translate(0, -60%)' }, // 오른쪽 위
  { radius: 1.28, transform: 'translate(0, -40%)' }, // 오른쪽 아래
  { radius: 1.34, transform: 'translate(-50%, 0)' }, // 아래
  { radius: 1.28, transform: 'translate(-100%, -40%)' }, // 왼쪽 아래
  { radius: 1.28, transform: 'translate(-100%, -60%)' }, // 왼쪽 위
];

export function Hexagon({ axes }: { axes: HexagonAxis[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const fractions = axes.map((axis) => axis.percent / 100);
  // 평균은 모든 축에서 같은 값이라 언제나 정확한 정육각형이다(HEXAGON_AVERAGE_PERCENT).
  const averageFraction = HEXAGON_AVERAGE_PERCENT / 100;
  const averageFractions = Array(AXIS_COUNT).fill(averageFraction);

  const hoveredAxis = hovered === null ? null : axes[hovered];
  // 툴팁은 그 축의 바깥쪽에 띄운다. svg 좌표를 %로 바꿔 얹으므로 도형이 커지거나
  // 작아져도 따라간다.
  // 라벨(1.2)보다 바깥에 띄운다 — 라벨을 덮으면 어느 축을 보고 있는지가 가려진다.
  const tooltipAt = hovered === null ? null : pointFor(hovered, 1.5);

  return (
    <div className="relative w-full max-w-xs">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`6각형 지표 — ${axes
          .map((axis) => `${axis.label} 나 ${axis.valueText}, 평균 ${axis.averageText}`)
          .join('; ')}`}
        className="w-full"
      >
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
          return <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={GRID_COLOR} />;
        })}

        {/* 코호트 평균 — 점선. 본인 도형 아래 깔아서 실선이 항상 위에 보이게 한다. */}
        <polygon
          data-testid="hexagon-average"
          points={polygonPoints(averageFractions)}
          fill="none"
          stroke={AVERAGE_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="4 3"
          opacity={0.85}
        />

        {/* 본인 — 실선. */}
        <polygon
          data-testid="hexagon-self"
          points={polygonPoints(fractions)}
          fill="rgba(255,146,51,0.25)"
          stroke={SELF_COLOR}
          strokeWidth={STROKE_WIDTH}
        />

        {/* 마우스가 올라간 축의 두 꼭짓점을 점으로 찍는다. 값이 비슷해 점이
            겹치면 평균(흰 점)이 위에 오도록 흰 점을 나중에 그린다 — 내 위치는
            도형 자체로도 읽히지만 평균은 이 점 말고는 짚을 데가 없다. */}
        {hovered !== null && (
          <g data-testid="hexagon-hover-dots">
            <circle
              cx={pointFor(hovered, fractions[hovered])[0]}
              cy={pointFor(hovered, fractions[hovered])[1]}
              r={4}
              fill={SELF_COLOR}
              stroke="#0E0B13"
              strokeWidth={1.5}
            />
            <circle
              cx={pointFor(hovered, averageFraction)[0]}
              cy={pointFor(hovered, averageFraction)[1]}
              r={4}
              fill={AVERAGE_COLOR}
              stroke="#0E0B13"
              strokeWidth={1.5}
            />
          </g>
        )}

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
              fill={hovered === index ? '#FFFFFF' : '#A0A0A2'}
            >
              {axis.label}
            </text>
          );
        })}

        {/* 마우스를 받는 부채꼴. 눈에 보이는 것 위에 얹어야 도형·글자 어디에
            올려도 같은 축이 잡힌다. */}
        {axes.map((axis, index) => (
          <polygon
            key={`hit-${axis.key}`}
            data-testid={`hexagon-hit-${axis.key}`}
            points={wedgePoints(index)}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
          />
        ))}
      </svg>

      {hoveredAxis && tooltipAt && (
        <div
          data-testid="hexagon-tooltip"
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-white/10 bg-[#1B1B23] px-2.5 py-1.5 text-[11px] leading-relaxed shadow-lg"
          style={{
            left: `${(tooltipAt[0] / SIZE) * 100}%`,
            top: `${(tooltipAt[1] / SIZE) * 100}%`,
          }}
        >
          <p className="tabular-nums text-menu">
            <span style={{ color: AVERAGE_COLOR }}>평균</span> {hoveredAxis.averageText}
          </p>
          <p className="font-bold tabular-nums text-foreground">
            <span style={{ color: SELF_COLOR }}>나</span> {hoveredAxis.valueText}
          </p>
        </div>
      )}
    </div>
  );
}
