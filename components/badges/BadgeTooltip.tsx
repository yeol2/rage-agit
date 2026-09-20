import type { ReactNode } from 'react';

/**
 * 뱃지 설명표 — 뱃지에 마우스를 올리면 위로 뜨는 카드.
 *
 * 작은 크기(표에서 22px)에서는 그림만으로 무슨 뱃지인지 알 수 없다. 그래서
 * **큰 그림 + 이름 + 설명**을 같이 띄운다 — 이름만 적으면 방금 본 작은 그림과
 * 같은 것인지 눈으로 잇기 어렵다.
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
  /** 설명표 왼쪽의 큰 그림. 48px 안팎으로 그려 넘긴다. */
  artwork: ReactNode;
  name: string;
  description: string;
  /** 맨 아랫줄 — 이 뱃지를 왜 받았는지(근거값, 횟수 등). */
  detail?: ReactNode;
  /** 말풍선을 찾을 때 쓰는 이름(테스트·스크린리더). */
  testId: string;
}

export function BadgeTooltip({ artwork, name, description, detail, testId }: BadgeTooltipProps) {
  return (
    <>
      <span
        role="tooltip"
        data-testid={testId}
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 flex w-max max-w-[15rem] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ background: TOOLTIP_BG }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">{artwork}</span>
        <span className="flex flex-col justify-center text-left">
          <b className="text-sm font-bold leading-tight text-foreground">{name}</b>
          <span className="mt-1 text-xs leading-relaxed text-menu">{description}</span>
          {detail && <span className="mt-1.5 text-[11px] leading-tight text-accent">{detail}</span>}
        </span>
      </span>

      <span className="sr-only">
        {name} — {description}
        {detail ? ' ' : ''}
        {detail}
      </span>
    </>
  );
}
