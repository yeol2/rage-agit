import type { ReactNode } from 'react';
import { BADGE_ART, type BadgeKey } from './badgeCatalog';

/**
 * 뱃지 하나 — 육각 핀 그림에 마우스를 올리면 설명표가 위로 뜬다.
 *
 * 작은 크기(리더보드 표는 22~26px)에서는 그림만으로 무슨 뱃지인지 알 수 없다.
 * 그래서 설명표에 **큰 그림 + 이름 + 설명**을 같이 띄운다 — 이름만 적으면
 * 방금 본 작은 그림과 같은 것인지 눈으로 잇기 어렵다.
 *
 * 말풍선은 위로 편다. 아래로 펴면 표에서 바로 다음 줄을 가린다(리더보드
 * 물음표 말풍선과 같은 규칙).
 */
const TOOLTIP_BG = '#1B1B23';

export interface BadgePinProps {
  badge: BadgeKey;
  /** 핀 크기. 바깥에서 글자 크기(em)에 맞추고 싶으면 '1.7em' 같은 값도 된다. */
  size?: string;
  /** 설명표 맨 아래 줄 — 이 뱃지를 왜 받았는지(근거값, 횟수 등). */
  detail?: ReactNode;
  /** 핀 위에 겹쳐 얹을 것. 내전우승은 여기에 횟수 알약을 넣는다. */
  overlay?: ReactNode;
}

export function BadgePin({ badge, size = '1.7em', detail, overlay }: BadgePinProps) {
  const art = BADGE_ART[badge];

  return (
    <span
      className="group relative inline-flex w-fit shrink-0 items-center justify-center"
      data-testid={`badge-pin-${badge}`}
    >
      <span className="relative inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다 */}
        <img src={art.src} alt="" aria-hidden="true" style={{ height: size, width: 'auto' }} />
        {overlay}
      </span>

      <span
        role="tooltip"
        data-testid={`badge-tooltip-${badge}`}
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 flex w-max max-w-[15rem] -translate-x-1/2 gap-3 rounded-xl border border-white/10 px-3 py-2.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ background: TOOLTIP_BG }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같은 이유 */}
        <img src={art.src} alt="" aria-hidden="true" className="h-12 w-12 shrink-0" />
        <span className="flex flex-col justify-center text-left">
          <b className="text-sm font-bold leading-tight text-foreground">{art.name}</b>
          <span className="mt-1 text-xs leading-relaxed text-menu">{art.description}</span>
          {detail && <span className="mt-1.5 text-[11px] leading-tight text-accent">{detail}</span>}
        </span>
      </span>

      <span className="sr-only">
        {art.name} — {art.description}
        {detail ? ' ' : ''}
      </span>
    </span>
  );
}
