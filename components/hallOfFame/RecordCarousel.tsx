'use client';

import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';

// 명예의 전당 카드를 한 장씩 집중해서 본다(2026-11-14 사용자 그림·참고 이미지).
//   · 가운데 카드 한 장이 크고 또렷하다.
//   · 양옆 카드는 절반이 안 되게만 보이고, 가운데보다 작고(SIDE_SCALE), 흐리다(블러).
//   · 끝이 없다 — 마지막 다음은 첫 카드, 첫 카드 앞은 마지막 카드(순환).
//   · 양옆 ‹ › 버튼, 옆 카드 누르기, 휴대폰에선 좌우로 밀기, 아래 점으로 넘긴다.
//   · 처음엔 첫 카드(내전 최다 킬)가 가운데다.
//
// 카드는 한 칸에 겹쳐 두고, 가운데 카드로부터 몇 칸 떨어졌는지(-2…+2)로 가로 위치를
// 정한다. 순환하면서 반대편 끝으로 건너가는 카드는 화면 밖이라 애니메이션 없이 옮긴다
// (그래야 화면을 가로질러 날아가지 않는다).

// 카드 사이 간격 — 휴대폰은 좁혀서 양옆 카드가 조금이라도 보이게 한다.
function gapFor(width: number): number {
  return width >= 560 ? 20 : 12;
}
const SIDE_SCALE = 0.86;
const SWIPE_PX = 40; // 이만큼 이상 밀어야 넘긴다(살짝 건드린 건 무시)

// 가운데 카드 폭 = 보이는 칸 × 이 비율. 옆 카드는 가운데 쪽 모서리를 기준으로 작아지므로
// 보이는 폭 = (칸 − 카드)/2 − 간격. 넓은 화면은 그게 옆 카드의 절반 조금 못 되게(≈48%),
// 휴대폰은 가운데 카드를 넉넉히 두고 옆은 끝만 살짝 보이게 한다.
function cardRatio(width: number): number {
  if (width >= 900) return 0.53;
  if (width >= 560) return 0.64;
  return 0.8; // 0.86 이면 휴대폰에서 옆 카드가 3px 만 보여 사실상 안 보였다
}

/** 가운데(index)에서 i 번째 카드까지 몇 칸인지, 가까운 쪽으로(순환). */
function distance(i: number, index: number, count: number): number {
  let d = (i - index) % count;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
}

export function RecordCarousel({ children }: { children: React.ReactNode }) {
  const cards = Children.toArray(children);
  const count = cards.length;
  const viewRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevDistance = useRef<number[]>([]);
  const [viewW, setViewW] = useState(0);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const update = () => setViewW(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 칸 높이는 가운데 카드 높이를 따라간다 — 기록마다 줄 수가 달라서(10~16줄),
  // 가장 긴 카드에 맞추면 짧은 카드 아래가 텅 빈다.
  useLayoutEffect(() => {
    const el = cardRefs.current[index];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, viewW]);

  const wrap = (n: number) => ((n % count) + count) % count;
  // 버튼·밀기는 "지금에서 한 칸" — 빠르게 두 번 누르면 화면이 다시 그려지기 전이라
  // 옛 번호를 보고 같은 칸으로 두 번 가는 일이 있어서, 항상 최신 번호에서 센다.
  const move = (direction: 1 | -1) => setIndex((current) => wrap(current + direction));
  const go = (target: number) => setIndex(wrap(target));

  const cardW = viewW * cardRatio(viewW);
  const gap = gapFor(viewW);
  const ready = viewW > 0;

  const arrow = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => move(direction)}
      aria-label={direction === -1 ? '이전 기록' : '다음 기록'}
      // 카드의 세로 가운데에 둔다(2026-11-15 사용자 요청 — 화면 높이에 붙어 따라오던 걸 바꿈).
      // 휴대폰에선 숨긴다 — 버튼 두 개가
      // 좁은 폭을 먹어 가운데 카드가 너무 작아진다(휴대폰은 밀기·아래 점으로 넘긴다).
      className="hidden h-12 w-12 shrink-0 items-center justify-center self-center rounded-full border border-white/10 bg-[#1B1B23] text-xl text-foreground transition-colors hover:border-white/25 sm:flex"
    >
      <span aria-hidden="true">{direction === -1 ? '‹' : '›'}</span>
    </button>
  );

  const distances = cards.map((_, i) => distance(i, index, count));
  // 이번에 그린 칸 거리를 기억해 둔다 — 다음 번에 "반대편으로 건너갔는지"를 알기 위해.
  useEffect(() => {
    prevDistance.current = distances;
  });

  return (
    <div>
      {/* 버튼과 카드 사이를 넉넉히 띄운다(사용자 요청). */}
      <div className="flex items-start gap-4 sm:gap-8 lg:gap-12">
        {arrow(-1)}
        <div
          ref={viewRef}
          data-testid="record-carousel"
          className="relative min-w-0 flex-1 touch-pan-y overflow-hidden transition-[height] duration-500 ease-out"
          style={{ height: height ?? undefined }}
          onPointerDown={(e) => {
            swipeStart.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeStart.current === null) return;
            const dx = e.clientX - swipeStart.current;
            swipeStart.current = null;
            if (Math.abs(dx) >= SWIPE_PX) move(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          {cards.map((card, i) => {
            const d = distances[i];
            const active = d === 0;
            // 한 번에 두 칸 넘게 움직이면 반대편 끝으로 건너간 카드다 — 화면 밖이라 그냥 옮긴다.
            const jumped = prevDistance.current[i] !== undefined && Math.abs(prevDistance.current[i] - d) > 1;
            const x = viewW / 2 - cardW / 2 + d * (cardW + gap);
            return (
              <div
                key={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-active={active}
                aria-hidden={!active}
                onClick={active ? undefined : () => go(i)}
                className={`absolute left-0 top-1/2 ${jumped ? '' : 'transition-[transform,filter,opacity] duration-500 ease-out'} ${
                  active ? '' : 'cursor-pointer select-none'
                }`}
                style={{
                  width: ready ? cardW : '100%',
                  // 옆 카드는 가운데 쪽 위 모서리를 기준으로 작아진다 — 가운데 기준이면
                  // 좁은 화면에서 옆 카드가 화면 밖으로 숨어 버렸다.
                  // 세로는 가운데 카드의 가운데에 맞춘다(2026-11-14 사용자 지적 — 위로 붙어 보였다).
                  transformOrigin: d < 0 ? 'right center' : d > 0 ? 'left center' : 'center center',
                  transform: `translateX(${ready ? x : 0}px) translateY(-50%) scale(${active ? 1 : SIDE_SCALE})`,
                  filter: active ? 'none' : 'blur(3px)',
                  opacity: active ? 1 : Math.abs(d) === 1 ? 0.45 : 0,
                  zIndex: active ? 2 : 1,
                }}
              >
                {/* 옆 카드 안의 글자·링크는 못 누르게 — 누르면 그 카드로 넘어갈 뿐이다. */}
                <div className={active ? '' : 'pointer-events-none'}>{card}</div>
              </div>
            );
          })}
        </div>
        {arrow(1)}
      </div>

      {/* 아래 점 — 지금 몇 번째인지, 눌러서 바로 가기. */}
      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="기록 넘기기">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${i + 1}번째 기록`}
            onClick={() => go(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? 'w-6 bg-accent' : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
