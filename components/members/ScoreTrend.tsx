'use client';

import { useEffect, useRef, useState } from 'react';
import type { SeriesPoint } from '@/lib/scoreHistory';
import type { TierColorRamp } from '@/lib/memberStats';

// 점수 변동 그래프. 사람들이 제일 궁금해하는 건 "지난 내전보다 몇 점 올랐나"라서
// 그 숫자를 머리에 크게 두고, 그래프는 흐름을 보여준다.
//
// 내가 쉰 날은 지난 점수를 그대로 이어서 일자로 그린다(lib/scoreHistory 참고) —
// 속이 빈 점이 그 칸이다.
//
// 최근 10회는 바로 위 "최근 10회 내전 종합등수" 칩과 **세로로 일자**가 되게 그린다
// (alignDates). 칩 줄도 이 그래프의 눈금 칸과 같은 폭(TREND_GUTTER_PX)을 왼쪽에
// 비워 두고, 점의 가로 위치는 칩과 같은 공식(같은 폭 n칸 + 칸 사이 CHIP_GAP_PX)으로
// 정한다. 그래서 폭을 실제로 재서(px) 그린다 — 퍼센트로는 칸 사이 간격을 못 맞춘다.

type ScoreWindow = 'alltime' | 'recent16';
type Range = 'recent10' | 'all';

export const TREND_GUTTER_PX = 52;
/** SessionStandingChips 의 gap-2. 바꾸면 칩과 점이 어긋난다. */
export const CHIP_GAP_PX = 8;

const RECENT_COUNT = 10;
const UP = '#4ADE80'; // 리더보드 등수 변동(text-green-400)과 같은 색
const DOWN = '#F87171'; // text-red-400
const PLOT_PAD_Y = 12; // 맨 위·맨 아래 점이 잘리지 않게
/** 칩 최소 폭(SessionStandingChips 가 그래프와 붙을 때의 min-w). 좁은 화면에서 둘이 같은 폭으로 스크롤된다. */
const CHIP_MIN_PX = 60;
const MIN_POINT_GAP_PX = 28; // 전체 보기에서 점 사이 최소 간격
const DATE_BAND_PX = 24; // 그래프 아래 날짜 줄 — 스크롤 칸 안에 같이 둔다(밖에 두면 잘린다)
const NEAR_PX = 26; // 기준선 이름(두 줄)끼리 이보다 가까우면 겹친다

function formatDelta(delta: number): string {
  return `${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(1)}`;
}

function shortDate(date: string): string {
  return date.slice(5); // MM-DD
}

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 그래프 세로 범위 — 5점 단위로 끊고, 너무 납작해 보이지 않게 최소 10점 폭을 둔다. */
function yRange(values: number[]): [number, number] {
  let lo = Math.max(0, Math.floor((Math.min(...values) - 2) / 5) * 5);
  let hi = Math.min(100, Math.ceil((Math.max(...values) + 2) / 5) * 5);
  while (hi - lo < 10) {
    if (hi < 100) hi += 5;
    if (hi - lo < 10 && lo > 0) lo -= 5;
  }
  return [lo, hi];
}

interface DisplayPoint {
  date: string;
  /** 아직 점수가 생기기 전이면 null — 그 칸은 비워 둔다. */
  value: number | null;
  /** 그날 점수에 센 경기를 뛰었는지. 아니면 속 빈 점(지난 점수 유지). */
  played: boolean;
  /** 그날 바뀐 점수(점수 이력에서 바로 앞 내전 대비). 뛴 날만. */
  delta: number | null;
}

/** 점수 이력(series)을 화면 칸(dates)에 옮긴다. 칸에 해당하는 점수가 없으면 직전 점수를 잇는다. */
function project(series: SeriesPoint[], window: ScoreWindow, dates: string[]): DisplayPoint[] {
  return dates.map((date) => {
    let idx = -1;
    for (let i = 0; i < series.length && series[i].date <= date; i++) idx = i;
    if (idx === -1) return { date, value: null, played: false, delta: null };
    const point = series[idx];
    const played = point.date === date && point.played;
    const delta = played && idx > 0 ? point[window] - series[idx - 1][window] : null;
    return { date, value: point[window], played, delta };
  });
}

function useSize<T extends HTMLElement>(external?: React.RefObject<T>) {
  const own = useRef<T>(null);
  const ref = external ?? own;
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return [ref, size] as const;
}

type ScoreTrendProps = Parameters<typeof ScoreTrendChart>[0];

export function ScoreTrend(props: ScoreTrendProps) {
  if (props.series.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-menu">
        아직 점수 기록이 없습니다. 집계 기준(통산 16경기)을 채운 뒤부터 쌓입니다.
      </p>
    );
  }
  return <ScoreTrendChart {...props} />;
}

function ScoreTrendChart({
  series,
  window,
  ramp,
  compact = false,
  alignDates,
  standingByDate,
  scrollRef,
}: {
  /**
   * 그래프의 가로 스크롤 칸. 위 칩 줄과 같이 움직이게 묶을 때 바깥(MemberDashboard)이
   * 넘긴다 — 좁은 화면에서 칩 줄이 옆으로 밀리면 그래프도 같이 밀려야 정렬이 산다.
   */
  scrollRef?: React.RefObject<HTMLDivElement>;
  /** 내전 날짜순 전체 점수(쉰 날은 이어 그린 값). */
  series: SeriesPoint[];
  /** 지금 보고 있는 집계 기준 — 그래프 끝점이 화면의 종합점수와 같아진다. */
  window: ScoreWindow;
  ramp: TierColorRamp;
  /** 리더보드 드롭다운 — 최근 10회만, 토글 없이. */
  compact?: boolean;
  /** 위 칩 줄의 날짜(오래된 순). 주면 최근 10회를 이 칸들에 맞춰 그린다. */
  alignDates?: string[];
  /** 그날 종합등수 — 말풍선에 "(1등)"으로 붙인다. */
  standingByDate?: Map<string, number>;
}) {
  const [range, setRange] = useState<Range>('recent10');
  const [hover, setHover] = useState<number | null>(null);
  // 보이는 칸(스크롤 칸)의 크기. 그래프 자체는 이보다 넓을 수 있다(좁은 화면).
  const [viewRef, { width: viewW, height: viewH }] = useSize<HTMLDivElement>(scrollRef);
  const [scrollLeft, setScrollLeft] = useState(0);
  const startedAtEnd = useRef<string | null>(null);

  const values = series.map((p) => p[window]);
  // 지난 내전 대비 — 전체 흐름에서 바로 앞 내전과 비교한다(보이는 범위와 무관).
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const delta = prev === null ? null : Math.round((last - prev) * 10) / 10;
  const lastPlayed = series[series.length - 1].played;

  const effectiveRange: Range = compact ? 'recent10' : range;
  const aligned = effectiveRange === 'recent10' && alignDates !== undefined && alignDates.length > 0;
  const dates = aligned
    ? alignDates
    : effectiveRange === 'recent10'
      ? series.slice(-RECENT_COUNT).map((p) => p.date)
      : series.map((p) => p.date);
  const points = project(series, window, dates);
  const n = points.length;

  // 그래프 폭. 칩에 맞출 땐 칩 줄과 같은 최소 폭(칩 n개 × CHIP_MIN_PX + 간격)을
  // 지켜서, 화면이 좁으면 칩 줄처럼 옆으로 스크롤된다. 전체 보기는 점 사이를 최소
  // MIN_POINT_GAP_PX 띄운다 — 54회를 휴대폰 폭에 욱여넣으면 날짜가 겹친다.
  const minW = aligned
    ? n * CHIP_MIN_PX + (n - 1) * CHIP_GAP_PX
    : n <= 1
      ? 0
      : 32 + (n - 1) * MIN_POINT_GAP_PX;
  const W = Math.max(viewW, minW);
  const H = viewH - DATE_BAND_PX; // 아래 날짜 줄만큼 뺀 그래프 높이

  // 내 역대 점수(지금 값) — 가로줄로 그어 "요즘 점수가 역대보다 위냐 아래냐"를 본다.
  // 티어 평균(50)과 같이 늘 보이도록 세로 범위에 둘 다 넣는다.
  const alltimeRef = series[series.length - 1].alltime;
  const shownValues = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const [lo, hi] = yRange([...shownValues, alltimeRef, 50]);

  const x = (i: number) => {
    if (aligned) {
      const w = (W - (n - 1) * CHIP_GAP_PX) / n;
      return i * (w + CHIP_GAP_PX) + w / 2;
    }
    const pad = 16;
    return n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1);
  };
  const y = (v: number) => PLOT_PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PLOT_PAD_Y * 2);

  const drawn = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as (DisplayPoint & {
    i: number;
    value: number;
  })[];
  const path = drawn.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.value)}`).join(' ');
  const area =
    drawn.length > 1
      ? `${path} L${x(drawn[drawn.length - 1].i)},${H} L${x(drawn[0].i)},${H} Z`
      : '';

  // 왼쪽 눈금: 기준선 두 개(티어 평균 50, 역대 점수)가 먼저고, 위·아래 끝 숫자는
  // 그 둘과 겹치지 않을 때만 적는다. 두 기준선끼리 붙으면 위쪽 것은 선 위로,
  // 아래쪽 것은 선 아래로 비켜 적는다.
  const refs = [
    { value: 50, main: '50점', sub: '(티어 평균)', color: undefined as string | undefined },
    { value: alltimeRef, main: `${alltimeRef.toFixed(1)}점`, sub: '(역대 점수)', color: ramp.from },
  ].sort((a, b) => b.value - a.value);
  const refsCollide = Math.abs(y(refs[0].value) - y(refs[1].value)) < NEAR_PX;
  const ticks = [hi, lo].filter((t) => refs.every((r) => Math.abs(y(t) - y(r.value)) >= NEAR_PX));
  // 날짜 글씨는 많아도 6개쯤만 — 칩과 맞춘 10칸은 칩에 날짜가 있어도 다 적는다.
  const labelEvery = aligned ? 1 : Math.max(1, Math.ceil(n / 6));
  const gradientId = `trend-${window}-${compact ? 'c' : 'f'}`;
  const ready = viewW > 0 && H > 0;

  // 처음엔 가장 최근 회차가 보이게 오른쪽 끝에서 시작한다(범위·창이 바뀔 때도).
  // 칩 줄과 묶여 있으면 그쪽도 따라온다.
  const layoutKey = `${effectiveRange}-${n}-${W}`;
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !ready || startedAtEnd.current === layoutKey) return;
    startedAtEnd.current = layoutKey;
    el.scrollLeft = el.scrollWidth;
  });

  // 손가락·마우스 위치에서 가장 가까운 점. 좌표는 그래프 안쪽(스크롤 포함) 기준.
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || drawn.length === 0) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = drawn[0].i;
    for (const p of drawn) if (Math.abs(x(p.i) - px) < Math.abs(x(best) - px)) best = p.i;
    setHover(best);
  };

  const hovered = hover === null ? null : points[hover];
  const hoveredStanding = hovered ? standingByDate?.get(hovered.date) : undefined;

  return (
    <div data-testid="score-trend">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {compact ? (
          <p className="hud text-[11px] text-menu">최근 {Math.min(RECENT_COUNT, n)}회 점수 변동</p>
        ) : (
          <p className="hud text-sm font-bold text-foreground">점수 변동</p>
        )}
        <div className="flex items-center gap-3">
          <p className="text-xs text-menu">
            지난 내전 대비{' '}
            {delta === null ? (
              <span className="font-bold text-foreground">첫 기록</span>
            ) : delta === 0 ? (
              <span className="font-bold text-foreground">{lastPlayed ? '변동 없음' : '불참 · 유지'}</span>
            ) : (
              <span className="text-sm font-bold" style={{ color: delta > 0 ? UP : DOWN }}>
                {formatDelta(delta)}점
              </span>
            )}
          </p>
          {!compact && (
            <div role="tablist" aria-label="점수 변동 범위" className="inline-flex rounded-xl bg-white/[0.03] p-0.5">
              {(
                [
                  ['recent10', `최근 ${RECENT_COUNT}회`],
                  ['all', '전체'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={range === id}
                  onClick={() => setRange(id)}
                  className={
                    range === id
                      ? 'rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-white'
                      : 'rounded-lg px-3 py-1 text-xs text-menu transition-colors hover:text-foreground'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="relative mt-5 grid"
        // 그래프 높이(208/288) + 날짜 줄
        style={{
          gridTemplateColumns: `${TREND_GUTTER_PX}px minmax(0, 1fr)`,
          height: (compact ? 208 : 288) + DATE_BAND_PX,
        }}
      >
        {/* 세로 눈금 — 글씨는 눈금 칸 가운데 정렬(숫자와 괄호 이름이 한 줄로 서게). */}
        <div className="relative">
          {ready &&
            ticks.map((t) => (
              <span
                key={t}
                className="absolute inset-x-0 -translate-y-1/2 text-center text-[10px] tabular-nums text-subtext"
                style={{ top: y(t) }}
              >
                {Math.round(t)}
              </span>
            ))}
          {ready &&
            refs.map((r, i) => (
              <span
                key={r.sub}
                data-testid={`trend-ref-${r.sub}`}
                className="absolute -inset-x-1 text-center leading-tight"
                style={{
                  top: y(r.value),
                  // 숫자 줄이 기준선 높이에 오게. 붙어 있을 땐 위 블록 바닥 = 위 선,
                  // 아래 블록 꼭대기 = 아래 선이라 절대 안 겹친다.
                  transform: refsCollide ? (i === 0 ? 'translateY(-100%)' : 'translateY(0)') : 'translateY(-0.6em)',
                  color: r.color,
                }}
              >
                <span className={`block text-[11px] font-bold tabular-nums ${r.color ? '' : 'text-menu'}`}>
                  {r.main}
                </span>
                <span className={`block whitespace-nowrap text-[10px] ${r.color ? 'opacity-80' : 'text-subtext'}`}>
                  {r.sub}
                </span>
              </span>
            ))}
        </div>

        {/* 스크롤 칸. 눈금(왼쪽)은 밖에 있어 스크롤해도 늘 보인다. 스크롤바는 숨기고
            위 칩 줄의 스크롤바로 같이 민다(묶여 있다). */}
        <div
          ref={viewRef}
          // 칩과 칸이 맞을 때(최근 10회)만 칩 줄과 스크롤을 묶는다 — 전체 보기는 칸
          // 간격이 달라서 같이 밀면 오히려 어긋난다. MemberDashboard 가 이 값을 본다.
          data-scroll-linked={aligned ? 'true' : 'false'}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        >
        <div
          className="relative h-full"
          style={{ width: W || '100%' }}
          onPointerMove={(e) => pick(e)}
          // 휴대폰은 마우스가 없다 — 탭한 곳의 점을 고르고, 손을 떼도 말풍선은 남긴다.
          onPointerDown={(e) => pick(e)}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null);
          }}
        >
          {ready && (
            <svg
              width={W}
              height={H}
              className="absolute inset-0 overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ramp.from} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={ramp.from} stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" />
              ))}
              {/* 티어 평균 — 가늘고 흰 점선 */}
              <line
                x1="0"
                x2={W}
                y1={y(50)}
                y2={y(50)}
                stroke="rgba(255,255,255,0.3)"
                strokeDasharray="3 4"
              />
              {/* 역대 점수 — 굵은 티어 색 점선. 티어 평균과 굵기·색으로 갈린다. */}
              <line
                x1="0"
                x2={W}
                y1={y(alltimeRef)}
                y2={y(alltimeRef)}
                stroke={ramp.from}
                strokeOpacity="0.85"
                strokeWidth="2.5"
                strokeDasharray="8 5"
              />
              {area && <path d={area} fill={`url(#${gradientId})`} />}
              {drawn.length > 1 && (
                <path d={path} fill="none" stroke={ramp.from} strokeWidth="2.5" strokeLinejoin="round" />
              )}
              {hover !== null && (
                <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="rgba(255,255,255,0.18)" />
              )}
            </svg>
          )}

          {ready &&
            drawn.map((p) => (
              <span
                key={p.date}
                data-testid={`trend-dot-${p.date}`}
                className="absolute h-2.5 w-2.5 rounded-full border-2"
                style={{
                  left: x(p.i),
                  top: y(p.value),
                  borderColor: ramp.from,
                  background: p.played ? ramp.from : '#141219',
                  transform: `translate(-50%, -50%) scale(${hover === p.i ? 1.4 : 1})`,
                }}
              />
            ))}

          {/* 날짜 */}
          {ready &&
            points.map((p, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <span
                  key={p.date}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-subtext"
                  style={{ left: x(i), top: H + 6 }}
                >
                  {shortDate(p.date)}
                </span>
              ) : null,
            )}

        </div>
        </div>

          {/* 말풍선은 스크롤 칸 밖(그래프 전체 기준)에 띄운다 — 안에 두면 위로 솟는
              말풍선이 스크롤 칸 경계에서 잘린다. 가로 위치는 스크롤한 만큼 뺀다. */}
          {ready && hovered && hover !== null && hovered.value !== null && (
            <div
              className="pointer-events-none absolute z-10 w-max rounded-lg border border-white/10 bg-[#1B1B23] px-3 py-2 text-left text-xs shadow-lg"
              style={{
                left: Math.min(
                  TREND_GUTTER_PX + viewW - 70,
                  Math.max(70, TREND_GUTTER_PX + x(hover) - scrollLeft),
                ),
                top: y(hovered.value),
                transform: 'translate(-50%, calc(-100% - 12px))',
              }}
            >
              <p className="text-menu">
                {shortDate(hovered.date)} ({weekday(hovered.date)})
              </p>
              <p className="mt-0.5 text-sm font-bold text-foreground">
                {hovered.value.toFixed(1)}점
                {hoveredStanding !== undefined && (
                  <span className="ml-1 font-normal text-menu">({hoveredStanding}등)</span>
                )}
              </p>
              <p className="mt-0.5 text-[11px]">
                {!hovered.played ? (
                  <span className="text-subtext">
                    {hoveredStanding !== undefined ? '점수 미반영 내전 · 지난 점수 유지' : '불참 · 지난 점수 유지'}
                  </span>
                ) : hovered.delta === null ? (
                  <span className="text-subtext">첫 기록</span>
                ) : Math.abs(hovered.delta) < 0.05 ? (
                  <span className="text-subtext">변동 없음</span>
                ) : (
                  <span style={{ color: hovered.delta > 0 ? UP : DOWN }}>{formatDelta(hovered.delta)}점</span>
                )}
              </p>
            </div>
          )}
      </div>
      {/* 기준선 두 개는 왼쪽 눈금에 이름을 적었고, 여기엔 속 빈 점 뜻만 남긴다. */}
      <div className="mt-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[10px] text-subtext">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full border-2"
            style={{ borderColor: ramp.from, background: '#141219' }}
          />
          불참 · 지난 점수 유지
        </span>
      </div>
    </div>
  );
}
