import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Hexagon, pointFor, polygonPoints } from './Hexagon';
import type { HexagonAxis } from '@/lib/memberStats';

afterEach(cleanup);

const axes: HexagonAxis[] = [
  { key: 'damage', label: '딜량', percentile: 80 },
  { key: 'kills', label: '킬', percentile: 60 },
  { key: 'headshot', label: '헤드샷', percentile: 40 },
  { key: 'survival', label: '생존', percentile: 90 },
  { key: 'assists', label: '어시', percentile: 20 },
  { key: 'rank', label: '순위', percentile: 70 },
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
});
