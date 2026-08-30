import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Hexagon, pointFor, polygonPoints } from './Hexagon';
import type { HexagonAxis } from '@/lib/memberStats';

afterEach(cleanup);

const axis = (
  key: HexagonAxis['key'],
  label: string,
  percent: number,
  averagePercent: number,
): HexagonAxis => ({
  key,
  label,
  percent,
  averagePercent,
  valueText: `${percent}값`,
  averageText: `${averagePercent}평균`,
});

const axes: HexagonAxis[] = [
  axis('damage', '딜량', 80, 55),
  axis('kills', '킬', 60, 45),
  axis('stability', '안정성', 40, 50),
  axis('survival', '생존', 90, 60),
  axis('assists', '어시', 20, 35),
  axis('rank', '순위', 70, 50),
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
    expect(screen.getByRole('img', { name: /^6각형 지표/ })).toBeInTheDocument();
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

  it('두 도형이 서로 다른 값을 좌표에 반영한다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const self = container.querySelector('[data-testid="hexagon-self"]');
    const avg = container.querySelector('[data-testid="hexagon-average"]');
    expect(self?.getAttribute('points')).not.toBe(avg?.getAttribute('points'));
  });

  it('평균 도형도 축마다 다른 자리에 찍힌다 — 티어 그룹 평균이라 사람마다 크기가 다르다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const avg = container.querySelector('[data-testid="hexagon-average"]');
    const distances = avg!
      .getAttribute('points')!
      .split(' ')
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return Math.hypot(x - 120, y - 120);
      });
    // 55%와 45%는 다른 반지름이어야 한다(예전처럼 전부 50%로 고정되지 않는다).
    expect(distances[0]).toBeGreaterThan(distances[1]);
  });

  it('두 도형의 선 굵기가 같다 — 굵기 차이가 안팎 비교를 흐린다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    const self = container.querySelector('[data-testid="hexagon-self"]');
    const avg = container.querySelector('[data-testid="hexagon-average"]');
    expect(self?.getAttribute('stroke-width')).toBe(avg?.getAttribute('stroke-width'));
  });

  it('축에 마우스를 올리면 평균과 내 값을 두 줄로 띄운다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    expect(container.querySelector('[data-testid="hexagon-tooltip"]')).toBeNull();

    fireEvent.mouseEnter(container.querySelector('[data-testid="hexagon-hit-damage"]')!);
    const tooltip = container.querySelector('[data-testid="hexagon-tooltip"]')!;
    expect(tooltip.textContent).toContain('평균');
    expect(tooltip.textContent).toContain('55평균');
    expect(tooltip.textContent).toContain('80값');

    fireEvent.mouseLeave(container.querySelector('[data-testid="hexagon-hit-damage"]')!);
    expect(container.querySelector('[data-testid="hexagon-tooltip"]')).toBeNull();
  });

  it('마우스를 올린 축에 점 두 개를 찍고, 평균(흰 점)을 나중에 그려 위에 올린다', () => {
    const { container } = render(<Hexagon axes={axes} />);
    fireEvent.mouseEnter(container.querySelector('[data-testid="hexagon-hit-kills"]')!);

    const dots = container.querySelectorAll('[data-testid="hexagon-hover-dots"] circle');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute('fill', '#FF9233');
    // 나중에 그려진 것이 위에 온다 — 겹쳤을 때 흰 점이 보여야 한다.
    expect(dots[1]).toHaveAttribute('fill', '#FFFFFF');
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
