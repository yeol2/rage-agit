import type { ReactNode } from 'react';

/**
 * 뱃지 설명표 — 뱃지에 마우스를 올리면 위로 뜨는 카드.
 *
 * 위에서부터 [이름] · 멘트 · 설명 · 큰 그림 · 메달 · 수치 순이다. 작은 크기
 * (표에서 34px)에서는 그림만으로 무슨 뱃지인지 알 수 없어서, 여기서는 그림을
 * 크게 다시 보여주고 이름과 뜻을 같이 적는다.
 *
 * 여는 것은 CSS 뿐이다(group-hover). 상태를 두면 표 수십 줄에 리렌더가 번진다.
 * 위로 펴는 이유는 리더보드 물음표 말풍선과 같다 — 아래로 펴면 바로 다음 줄을
 * 가린다.
 *
 * 그림은 뱃지마다 다른 종류다: 플레이 스타일 뱃지는 핀 사진(PNG), 내전우승은
 * 트로피 글리프(SVG). 그래서 src 가 아니라 **그려둔 것을 그대로 받는다**.
 */
const TOOLTIP_BG = '#1B1B23';

export interface BadgeTooltipProps {
  name: string;
  /** 이름 아래 한 줄 — 뱃지 성격을 놀리는 말. */
  quip: string;
  /** 무슨 기준으로 주는 뱃지인지. 작은 회색 글씨로 깔린다. */
  description: string;
  /** 큰 그림. 64px 안팎으로 그려 넘긴다. */
  artwork: ReactNode;
  /** 메달 줄 — "3~3.5티어 금메달". 내전우승처럼 메달이 없으면 안 넘긴다. */
  medalLine?: ReactNode;
  /** 맨 아랫줄의 뚜렷한 수치. */
  statLine?: ReactNode;
  /** 말풍선을 찾을 때 쓰는 이름(테스트·스크린리더). */
  testId: string;
}

export function BadgeTooltip({
  name,
  quip,
  description,
  artwork,
  medalLine,
  statLine,
  testId,
}: BadgeTooltipProps) {
  return (
    <>
      <span
        role="tooltip"
        data-testid={testId}
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 flex w-max max-w-[17rem] -translate-x-1/2 flex-col items-center rounded-xl border border-white/10 px-4 py-3 text-center opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
        style={{ background: TOOLTIP_BG }}
      >
        <b className="text-sm font-bold leading-tight text-foreground">[{name}]</b>
        <span className="mt-1 text-xs font-semibold leading-tight text-accent">{quip}</span>
        <span className="mt-1.5 text-[11px] leading-relaxed text-menu">{description}</span>

        <span className="my-2.5 flex items-center justify-center">{artwork}</span>

        {medalLine && (
          <span className="text-xs font-bold leading-tight text-foreground">{medalLine}</span>
        )}
        {statLine && (
          <span className="mt-1 text-[11px] leading-tight text-menu">{statLine}</span>
        )}
      </span>

      <span className="sr-only">
        {name} — {quip} {description} {medalLine} {statLine}
      </span>
    </>
  );
}
