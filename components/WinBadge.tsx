import type { ReactNode } from 'react';
import { BadgeTooltip } from '@/components/badges/BadgeTooltip';
import { BADGE_COPY, type TrophyKind } from '@/components/badges/badgeCatalog';
import { BADGE_SIZE, HexFrame } from '@/components/badges/HexFrame';

/**
 * 내전우승 뱃지 — 트로피 하나에 횟수를 숫자로 붙인다.
 *
 * 예전에는 횟수만큼 트로피를 늘어놓았다. 우승이 쌓일수록 가로로 길어져서 4위
 * 이하 표에서는 뱃지 칸을 넘겼고(모바일 48px 칸은 4개부터 잘린다), 그걸 막으려고
 * 화면 폭에 따라 두 벌을 그려두고 CSS 로 골라 보였다. 한 벌로 줄이면 폭이
 * 횟수와 무관하게 고정되고, 몇 번인지도 한눈에 읽힌다 — 트로피 여덟 개를 세는
 * 것보다 숫자 '8' 이 빠르다.
 *
 * 그림은 다른 뱃지와 같은 방식이다 — 배경을 지운 PNG 를 같은 육각 틀에 넣는다.
 * 트로피만 SVG 글리프로 그리던 때는 같은 줄에서 재질이 혼자 달라 보였다.
 *
 * 저티어 내전 우승(꽃게들의 왕)도 같은 모양이다 — 그림과 문구만 다르다(kind).
 */
export interface WinBadgeProps {
  count: number;
  /** 어떤 우승 트로피인가. 기본은 일반 내전우승. */
  kind?: TrophyKind;
  /** 숫자 크기를 정하는 곳. 뱃지 자체 크기는 size 가 정한다. */
  className?: string;
  /** 우승이 0회일 때 대신 그릴 것. 표는 '-' 를 넣어 칸이 비어 보이지 않게 한다. */
  none?: ReactNode;
  /**
   * 숫자 뒤 알약 색. 뒤에 깔린 배경과 같아야 알약이 줄 위에 얹힌 것처럼 보인다.
   * 기본값은 카드·표 줄에 공통으로 쓰는 그래파이트다.
   */
  chipColor?: string;
  /** 뱃지 한 변. 다른 뱃지와 같은 값을 써야 한 줄에서 크기가 안 어긋난다. */
  size?: string;
}

const DEFAULT_CHIP_COLOR = '#1B1B23';

const TROPHY_IMAGE: Record<TrophyKind, string> = {
  scrimWin: '/badges/scrim-win.png',
  crabKing: '/badges/crab-king.png',
};

const STAT_LABEL: Record<TrophyKind, string> = {
  scrimWin: '내전 종합 1위',
  crabKing: '저티어 내전 종합 1위',
};

// 꽃게들의 왕 그림은 받침대가 내전우승 트로피와 같은 자리·크기가 되도록 그렸고, 그 위의
// 꽃게는 원래 칸(256)을 넘는다. 그래서 그림을 사방으로 넓힌 캔버스(416 = 256 + 80*2)에
// 그려두고 여기서 그만큼(416/256) 키워 가운데를 맞춘다 — 받침대는 트로피와 겹치고,
// 꽃게만 틀 밖으로 조금 나온다.
const ART_OVERSCAN: Record<TrophyKind, number> = {
  scrimWin: 1,
  crabKing: 416 / 256,
};

// 육각 테두리 색. 꽃게들의 왕은 꽃게 색(빨강)에 맞춘다.
const FRAME_STROKE: Record<TrophyKind, string | undefined> = {
  scrimWin: undefined,
  crabKing: '#FF5A5A',
};

function Trophy({ kind }: { kind: TrophyKind }) {
  const overscan = ART_OVERSCAN[kind];
  const inset = `${((1 - overscan) / 2) * 100}%`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다
    <img
      src={TROPHY_IMAGE[kind]}
      alt=""
      aria-hidden="true"
      data-testid={kind === 'scrimWin' ? 'trophy-art' : 'crab-king-art'}
      className={overscan === 1 ? 'h-full w-full' : 'absolute max-w-none'}
      style={
        overscan === 1
          ? { objectFit: 'contain' }
          : { objectFit: 'contain', width: `${overscan * 100}%`, height: `${overscan * 100}%`, left: inset, top: inset }
      }
    />
  );
}

export function WinBadge({
  count,
  kind = 'scrimWin',
  className = '',
  none = null,
  chipColor = DEFAULT_CHIP_COLOR,
  size = BADGE_SIZE,
}: WinBadgeProps) {
  if (count <= 0) return <>{none}</>;

  return (
    <span
      className={`group relative inline-flex w-fit shrink-0 items-center justify-center ${className}`}
      data-testid={kind === 'scrimWin' ? 'win-badge' : 'crab-king-badge'}
    >
      {/* 횟수는 육각형 **맨 아래 꼭짓점**에 걸쳐 놓는다. 트로피 몸통 위에 얹으면
          그림 한가운데를 가려서 무엇인지 잘 안 보인다. */}
      <span className="relative inline-flex">
        <HexFrame size={size} stroke={FRAME_STROKE[kind]}>
          <Trophy kind={kind} />
        </HexFrame>

        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 min-w-[1.3em] -translate-x-1/2 translate-y-[38%] rounded-full px-[0.3em] text-center text-[0.68em] font-bold leading-[1.45] tabular-nums text-white"
          style={{ background: chipColor, boxShadow: `0 0 0 1px ${chipColor}` }}
        >
          {count}
        </span>
      </span>

      <BadgeTooltip
        testId={`badge-tooltip-${kind}`}
        name={BADGE_COPY[kind].name}
        quip={BADGE_COPY[kind].quip}
        description={BADGE_COPY[kind].description}
        statLine={`${STAT_LABEL[kind]} ${count}회`}
        artwork={
          <HexFrame size="6rem" stroke={FRAME_STROKE[kind]}>
            <Trophy kind={kind} />
          </HexFrame>
        }
      />
    </span>
  );
}
