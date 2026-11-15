import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScoreTrend } from './ScoreTrend';
import type { SeriesPoint } from '@/lib/scoreHistory';

afterEach(cleanup);

// jsdom(테스트용 가짜 브라우저)은 화면을 안 그려서 폭이 늘 0 이고 ResizeObserver 도
// 없다. 실제 브라우저에는 다 있으므로 컴포넌트는 그대로 두고, 여기서만 채워 준다.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 700 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 288 });
});

const ramp = { from: '#E5A04C', to: '#B8742C' };

// 12회 — 마지막 두 칸: 11회차 60.0 → 12회차 63.2(▲3.2).
const SERIES: SeriesPoint[] = Array.from({ length: 12 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  alltime: 50 + i,
  recent16: i === 11 ? 63.2 : 60,
  played: i !== 5,
}));

describe('ScoreTrend', () => {
  it('지난 내전 대비 변동을 보고 있는 집계 기준으로 보여준다', () => {
    render(<ScoreTrend series={SERIES} window="recent16" ramp={ramp} />);
    expect(screen.getByText('▲3.2점')).toBeInTheDocument();
  });

  it('창이 바뀌면 그 창의 변동을 쓴다', () => {
    render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} />);
    expect(screen.getByText('▲1.0점')).toBeInTheDocument();
  });

  it('상세 화면은 최근 10회가 기본이고 전체로 넓힐 수 있다', () => {
    render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} />);
    expect(screen.queryByText('10-01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '전체' }));
    expect(screen.getByText('10-01')).toBeInTheDocument();
  });

  it('리더보드(compact)는 토글 없이 최근 10회만', () => {
    render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} compact />);
    expect(screen.queryByRole('tab', { name: '전체' })).not.toBeInTheDocument();
    expect(screen.getByText('최근 10회 점수 변동')).toBeInTheDocument();
  });

  it('마지막 내전에 쉬었어도 점수가 바뀌었으면 변동을 적고 (불참)을 붙인다', () => {
    const rested = [...SERIES.slice(0, 11), { ...SERIES[10], date: '2026-10-12', alltime: 58.5, played: false }];
    render(<ScoreTrend series={rested} window="alltime" ramp={ramp} />);
    expect(screen.getByText('▼1.5점')).toBeInTheDocument();
    expect(screen.getByText('(불참)')).toBeInTheDocument();
  });

  it('마지막 점은 화면의 지금 종합점수로 덮는다 — 그래프 끝과 링 숫자가 같아야 한다', () => {
    // 이력의 마지막 값은 61(역대) 이지만 화면엔 48.5 가 보인다.
    render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} liveScores={{ alltime: 48.5, recent16: null }} />);
    expect(screen.getByText('▼11.5점')).toBeInTheDocument();
    expect(screen.getByTestId('trend-ref-(역대 점수)')).toHaveTextContent('48.5점');
  });

  it('왼쪽 눈금에 티어 평균(50점)과 역대 점수 기준선을 적는다', () => {
    render(<ScoreTrend series={SERIES} window="recent16" ramp={ramp} />);
    expect(screen.getByTestId('trend-ref-(티어 평균)')).toHaveTextContent('50점(티어 평균)');
    // 역대 점수 = 마지막 칸의 역대 점수(61) — 최근 창을 보고 있어도 역대 값이다.
    expect(screen.getByTestId('trend-ref-(역대 점수)')).toHaveTextContent('61.0점(역대 점수)');
    expect(screen.queryByText('밴드 평균(50점)')).not.toBeInTheDocument();
  });

  it('칩 날짜에 맞춰 그리면 점이 칩 가운데(같은 폭 n칸 + 8px 간격)에 놓인다', () => {
    // 칩 10칸 — 마지막 칸(10-13)은 점수에 안 든 내전이라 직전 점수를 잇는다.
    const chips = [...SERIES.slice(3).map((p) => p.date), '2026-10-13'];
    render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} alignDates={chips} />);
    // 그래프 폭 700, 10칸: 칸 폭 (700 - 9×8)/10 = 62.8 → 첫 칸 가운데 31.4, 마지막 668.6
    expect(screen.getByTestId(`trend-dot-${chips[0]}`).style.left).toBe('31.4px');
    const lastDot = screen.getByTestId('trend-dot-2026-10-13');
    expect(parseFloat(lastDot.style.left)).toBeCloseTo(668.6, 5);
    // 점수에 안 든 날은 속 빈 점
    expect(lastDot.style.background).not.toBe(ramp.from);
  });

  it('좁은 화면이면 칩 최소 폭만큼 넓혀 옆으로 스크롤하고, 칩과 맞출 때만 스크롤을 묶는다', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    const chips = SERIES.slice(2).map((p) => p.date);
    const { container } = render(<ScoreTrend series={SERIES} window="alltime" ramp={ramp} alignDates={chips} />);
    const view = container.querySelector('[data-scroll-linked]') as HTMLElement;
    expect(view.dataset.scrollLinked).toBe('true');
    // 칩 10칸 × 60 + 간격 9 × 8 = 672 — 보이는 폭(300)보다 넓다.
    expect((view.firstElementChild as HTMLElement).style.width).toBe('672px');
    fireEvent.click(screen.getByRole('tab', { name: '전체' }));
    expect(view.dataset.scrollLinked).toBe('false');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 700 });
  });

  it('기록이 없으면 이유를 적는다', () => {
    render(<ScoreTrend series={[]} window="alltime" ramp={ramp} />);
    expect(screen.getByText(/아직 점수 기록이 없습니다/)).toBeInTheDocument();
  });
});
