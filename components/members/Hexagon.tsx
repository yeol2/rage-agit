'use client';

import { useState } from 'react';
import type { HexagonAxis } from '@/lib/memberStats';

const SIZE = 240;
const CENTER = SIZE / 2;

// 그림 자체는 240 짜리 정사각형이지만, 축 라벨과 물음표·평균 꼬리표가 그 밖으로
// 나간다. viewBox 를 사방으로 똑같이 넓혀서 잘리지 않게 한다 — 상하좌우를 같은
// 값으로 넓혀야 6각형이 계속 정가운데에 있는다.
const PAD = 26;
const VIEW_MIN = -PAD;
const VIEW_SIZE = SIZE + PAD * 2;

// svg 좌표를 겹쳐 놓은 HTML 요소의 위치(%)로 옮긴다.
function toPercent(coordinate: number): string {
  return `${((coordinate - VIEW_MIN) / VIEW_SIZE) * 100}%`;
}
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

// 좌표를 소수 셋째 자리에서 끊는다. Math.cos/sin 의 마지막 비트가 서버(Node)와
// 브라우저에서 다르게 나오는 경우가 있어서(...190716 대 ...19073), 그대로 쓰면
// 서버가 그린 SVG 와 브라우저가 그린 SVG 의 points 문자열이 달라 React 가
// hydration 불일치를 경고한다. 240 짜리 viewBox 에서 0.001 은 화면 픽셀보다
// 훨씬 작으므로 그림은 달라지지 않는다.
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// index 0 이 12시 방향에서 시작해 시계방향으로 6등분한다.
// index 는 정수가 아니어도 된다 — 축 사이(예: 0.5)를 가리키면 두 축의 중간
// 방향이 나오고, 마우스를 받는 부채꼴을 그 방향들로 만든다.
export function pointFor(index: number, fraction: number): [number, number] {
  const angle = (Math.PI * 2 * index) / AXIS_COUNT - Math.PI / 2;
  const r = RADIUS * fraction;
  return [round(CENTER + r * Math.cos(angle)), round(CENTER + r * Math.sin(angle))];
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
  { radius: 1.38, transform: 'translate(-50%, -100%)' }, // 위
  { radius: 1.46, transform: 'translate(0, -60%)' }, // 오른쪽 위
  { radius: 1.46, transform: 'translate(0, -40%)' }, // 오른쪽 아래
  { radius: 1.38, transform: 'translate(-50%, 0)' }, // 아래
  { radius: 1.46, transform: 'translate(-100%, -40%)' }, // 왼쪽 아래
  { radius: 1.46, transform: 'translate(-100%, -60%)' }, // 왼쪽 위
];

// 평균 꼬리표는 1시 방향(축과 축 사이)으로 뺀다. 축 위로 빼면 그 축의 라벨과
// 겹치고, 축 사이라면 도형 어느 선도 가리지 않는다.
const CALLOUT_INDEX = 0.5;
const CALLOUT_END = 1.24;
// 대각선 끝에서 가로로 조금 더 빼고 거기에 글자를 붙인다. 기울어진 선 끝에
// 글자를 바로 달면 글자가 선을 타고 올라가는 것처럼 보인다 — 가로 구간이
// 받침 노릇을 해서 글자가 수평으로 놓인다.
const CALLOUT_ELBOW = 26;

// 안정성 축(2번, 4시 방향) 라벨 오른쪽에 붙는 물음표. 라벨 글자폭만큼 띄운다.
const HELP_AXIS_INDEX = 2;
const HELP_OFFSET_X = 26;

export interface HexagonProps {
  axes: HexagonAxis[];
  /** 점선이 어느 무리의 평균인지. 꼬리표에 그대로 적는다(예: '3~3.5티어'). */
  averageLabel: string;
  /** 안정성 축 물음표에 뜨는 설명. */
  stabilityHelp: string;
}

export function Hexagon({ axes, averageLabel, stabilityHelp }: HexagonProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const fractions = axes.map((axis) => axis.percent / 100);
  // 점선은 내 티어 그룹의 평균이다. 눈금이 클랜 전체 기준 하나라서, 높은 티어
  // 그룹일수록 이 도형이 크게 그려진다.
  const averageFractions = axes.map((axis) => axis.averagePercent / 100);

  const hoveredAxis = hovered === null ? null : axes[hovered];
  // 툴팁은 그 축의 바깥쪽에 띄운다(라벨은 1.2). svg 좌표를 %로 바꿔 얹으므로
  // 도형이 커지거나 작아져도 따라간다.
  const tooltipAt = hovered === null ? null : pointFor(hovered, TOOLTIP_PLACEMENT[hovered].radius);

  return (
    <div className="relative w-full max-w-xs">
      <svg
        viewBox={`${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`}
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
              cx={pointFor(hovered, averageFractions[hovered])[0]}
              cy={pointFor(hovered, averageFractions[hovered])[1]}
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

        {/* 점선이 무엇인지 그림 안에서 바로 말해준다. 선 하나를 1시 방향으로
            빼고 그 끝에 어느 무리의 평균인지 적는다 — 범례를 따로 두면 눈이
            그림과 범례를 왕복해야 한다. */}
        <polyline
          data-testid="hexagon-average-callout"
          points={[
            pointFor(CALLOUT_INDEX, averageFractions[0] * Math.cos(Math.PI / 6)),
            pointFor(CALLOUT_INDEX, CALLOUT_END),
            [pointFor(CALLOUT_INDEX, CALLOUT_END)[0] + CALLOUT_ELBOW, pointFor(CALLOUT_INDEX, CALLOUT_END)[1]],
          ]
            .map((point) => point.join(','))
            .join(' ')}
          fill="none"
          stroke={AVERAGE_COLOR}
          strokeWidth={1}
          opacity={0.5}
        />

        {/* 안정성 물음표. 부채꼴보다 나중에 그려야 마우스가 여기로 들어온다. */}
        <g
          data-testid="hexagon-stability-help"
          onMouseEnter={() => setHelpOpen(true)}
          onMouseLeave={() => setHelpOpen(false)}
          style={{ cursor: 'default' }}
        >
          <circle
            cx={pointFor(HELP_AXIS_INDEX, 1.2)[0] + HELP_OFFSET_X}
            cy={pointFor(HELP_AXIS_INDEX, 1.2)[1]}
            r={7}
            fill="transparent"
            stroke={helpOpen ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
          />
          <text
            x={pointFor(HELP_AXIS_INDEX, 1.2)[0] + HELP_OFFSET_X}
            y={pointFor(HELP_AXIS_INDEX, 1.2)[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight="bold"
            fill={helpOpen ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
          >
            ?
          </text>
        </g>
      </svg>

      {/* 꼬리표 글자. svg 안에 두면 viewBox 를 더 넓혀야 하고, 그만큼 6각형이
          작아진다. */}
      <span
        className="pointer-events-none absolute whitespace-nowrap text-[10px] leading-none text-white/70"
        style={{
          left: toPercent(pointFor(CALLOUT_INDEX, CALLOUT_END)[0] + CALLOUT_ELBOW),
          top: toPercent(pointFor(CALLOUT_INDEX, CALLOUT_END)[1]),
          transform: 'translate(4px, -50%)',
        }}
      >
        {averageLabel} 평균
      </span>

      {helpOpen && (
        <div
          data-testid="hexagon-stability-tooltip"
          // 오른쪽으로 편다. 왼쪽으로 펴면 말풍선이 6각형을 통째로 덮어서,
          // 설명을 읽는 동안 정작 설명 대상이 안 보인다.
          className="pointer-events-none absolute z-10 w-[13rem] rounded-lg border border-white/10 bg-[#1B1B23] px-3 py-2 text-left text-xs leading-relaxed text-menu shadow-lg"
          style={{
            left: toPercent(pointFor(HELP_AXIS_INDEX, 1.2)[0] + HELP_OFFSET_X),
            top: toPercent(pointFor(HELP_AXIS_INDEX, 1.2)[1]),
            transform: 'translate(12px, -50%)',
          }}
        >
          <b className="font-bold text-foreground">안정성</b> · {stabilityHelp}
        </div>
      )}

      {/* 마우스를 못 쓰는 경우에도 설명이 남아 있어야 한다. */}
      <span className="sr-only">안정성: {stabilityHelp}</span>

      {hoveredAxis && tooltipAt && (
        <div
          data-testid="hexagon-tooltip"
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-white/10 bg-[#1B1B23] px-2.5 py-1.5 text-[11px] leading-relaxed shadow-lg"
          style={{
            left: toPercent(tooltipAt[0]),
            top: toPercent(tooltipAt[1]),
            transform: TOOLTIP_PLACEMENT[hovered!].transform,
          }}
        >
          {/* 콜론을 자기 칸에 두면 두 줄의 ':' 가 세로로 딱 맞는다. 이름은 그
              칸에 붙게 오른쪽 정렬, 값은 왼쪽 정렬이라 숫자도 같이 맞는다. */}
          <div className="grid grid-cols-[auto_auto_auto] items-baseline gap-x-1 tabular-nums">
            <span className="text-right" style={{ color: AVERAGE_COLOR }}>
              평균
            </span>
            <span className="text-menu">:</span>
            <span className="text-menu">{hoveredAxis.averageText}</span>

            <span className="text-right font-bold" style={{ color: SELF_COLOR }}>
              나
            </span>
            <span className="text-menu">:</span>
            <span className="font-bold text-foreground">{hoveredAxis.valueText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
