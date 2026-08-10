import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Hexagon, pointFor, polygonPoints } from './Hexagon';
import type { HexagonAxis } from '@/lib/memberStats';

afterEach(cleanup);

const axes: HexagonAxis[] = [
  { key: 'damage', label: '딜량', percentile: 80, averagePercentile: 55 },
  { key: 'kills', label: '킬', percentile: 60, averagePercentile: 45 },
  { key: 'headshot', label: '헤드샷', percentile: 40, averagePercentile: 50 },
  { key: 'survival', label: '생존', percentile: 90, averagePercentile: 60 },
  { key: 'assists', label: '어시', percentile: 20, averagePercentile: 35 },
  { key: 'rank', label: '순위', percentile: 70, averagePercentile: 50 },
];

describe('pointFor', () => {
  it('0번 축은 12시 방향(중심보다 y가 작다)에 놓인다', () => {
    const [x, y] = pointFor(0, 1);
    const [cx, cy] = pointFor(0, 0);
    expect(x).toBeCloseTo(cx, 5);
    expect(y).toBeLessThan(cy);
  });

  it('fraction 이 0이면 중심점이다', () => {
    const [x1, y1] = pointFor(0, 0);
    const [x2, y2] = pointFor(3, 0);
    expect(x1).toBeCloseTo(x2, 5);
    expect(y1).toBeCloseTo(y2, 5);
  });
});

describe('polygonPoints', () => {
  it('6개 좌표를 공백으로 이어붙인다', () => {
    const points = polygonPoints([1, 1, 1, 1, 1, 1]);
    expect(points.split(' ')).toHaveLength(6);
  });

  it('전부 0이면 여섯 점이 모두 중심에 겹친다', () => {
    const points = polygonPoints([0, 0, 0, 0, 0, 0]);
    const unique = new Set(points.split(' '));
    expect(unique.size).toBe(1);
  });
});

describe('Hexagon', () => {
  it('6개 축 라벨을 전부 그린다', () => {
    render(<Hexagon axes={axes} />);
    for (const axis of axes) {
      expect(screen.getByText(axis.label)).toBeInTheDocument();
    }
  });

  it('접근성을 위한 role과 라벨을 갖는다', () => {
    render(<Hexagon axes={axes} />);
    expect(screen.getByRole('img', { name: '6각형 지표' })).toBeInTheDocument();
  });

  it('본인 도형은 실선, 코호트 평균 도형은 점선으로 겹쳐 그린다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const self = container.querySelector('[data-testid="hexagon-self"]');
    const avg = container.querySelector('[data-testid="hexagon-average"]');
    expect(self).not.toBeNull();
    expect(avg).not.toBeNull();
    // 본인 도형엔 점선 속성이 없어야 하고, 평균 도형엔 있어야 한다.
    expect(self).not.toHaveAttribute('stroke-dasharray');
    expect(avg).toHaveAttribute('stroke-dasharray');
  });

  it('두 도형이 서로 다른 percentile 값을 좌표에 반영한다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const self = container.querySelector('[data-testid="hexagon-self"]');
    const avg = container.querySelector('[data-testid="hexagon-average"]');
    expect(self?.getAttribute('points')).not.toBe(avg?.getAttribute('points'));
  });

  it('그리드 선은 어두운 검정 계열이 아니라 흰색 계열로 밝게 그린다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const ring = container.querySelector('[data-testid="hexagon-grid-ring"]');
    expect(ring).toHaveAttribute('stroke', expect.stringContaining('255,255,255'));
    // 기존의 거의 안 보이던 0.08 수준보다 뚜렷하게 밝아야 한다.
    const opacityMatch = ring?.getAttribute('stroke')?.match(/0\.(\d+)\)/);
    const opacity = opacityMatch ? Number(`0.${opacityMatch[1]}`) : 0;
    expect(opacity).toBeGreaterThan(0.2);
  });
});
