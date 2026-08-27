'use client';

import { useEffect, useState } from 'react';
import type { TierColorRamp } from '@/lib/memberStats';

// 링 기하 — 반지름 82, 굵기 13 의 200×200 좌표계.
// 바닥 한 점에서 좌·우 두 갈래가 **동시에** 차오르고 100점이면 꼭대기에서 만난다.
// 시작점은 바닥 정중앙에서 3° 씩 벌려 두 갈래가 붙어 보이지 않게 한다.
const ARC_LEFT = 'M 95.71 181.89 A 82 82 0 0 1 100 18';
const ARC_RIGHT = 'M 104.29 181.89 A 82 82 0 0 0 100 18';
const ARC_LENGTH = Math.PI * 82 * (177 / 180);

// 좌우 3시·9시가 정확히 절반 지점이라, 거기가 곧 50점이다. rageScores 가 티어
// 밴드 평균(z=0)을 50점으로 두므로 이 점은 계산 없이 기하학적으로 "그룹 평균"이
// 된다. 채움 위에 그려서 점수가 50 을 넘어도 가려지지 않게 한다.
const AVERAGE_MARKS = [18, 182];

export interface ScoreRingProps {
  score: number;
  ramp: TierColorRamp;
  /** 링 안 아래쪽 작은 글씨 — 예: '2~2.5티어 중 14위'. 없으면 안 그린다. */
  caption?: string;
  /** 리더보드 드롭다운처럼 좁은 자리에서 쓰는 압축 모드. */
  compact?: boolean;
  /** 같은 문서에 여러 개가 그려지므로 그라디언트 id 가 겹치면 안 된다. */
  gradientId: string;
}

export function ScoreRing({ score, ramp, caption, compact = false, gradientId }: ScoreRingProps) {
  // 마운트 뒤에 0 → 실제 점수로 한 번 차오르게 한다. 처음부터 채운 채로 그리면
  // "물이 차오른다"는 이 게이지의 요지가 안 보인다.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const fraction = Math.min(1, Math.max(0, score / 100));
  const offset = filled ? ARC_LENGTH * (1 - fraction) : ARC_LENGTH;
  const arcStyle = {
    strokeDasharray: ARC_LENGTH,
    strokeDashoffset: offset,
    transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 0.75, 0.3, 1)',
  };

  return (
    <div
      className="relative aspect-square w-full"
      style={{ maxWidth: compact ? 136 : 200 }}
      data-testid="score-ring"
    >
      <svg viewBox="0 0 200 200" className="block h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          {/* 아래(어두움) → 위(밝음). 물이 차오를수록 밝아진다. */}
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={ramp.from} />
            <stop offset="100%" stopColor={ramp.to} />
          </linearGradient>
          {!compact && (
            <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {[ARC_LEFT, ARC_RIGHT].map((d) => (
          <path
            key={`track-${d}`}
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="13"
            strokeLinecap="round"
          />
        ))}

        {[ARC_LEFT, ARC_RIGHT].map((d) => (
          <path
            key={`fill-${d}`}
            d={d}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="13"
            strokeLinecap="round"
            filter={compact ? undefined : `url(#${gradientId}-glow)`}
            style={arcStyle}
          />
        ))}

        {AVERAGE_MARKS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy="100"
            r="2.6"
            fill="rgba(14,11,19,0.9)"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.3"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className={`font-bold leading-none tracking-tight tabular-nums ${compact ? 'text-[27px]' : 'text-[40px]'}`}
        >
          {score.toFixed(1)}
          <span className={`ml-0.5 font-bold text-white/70 ${compact ? 'text-xs' : 'text-base'}`}>
            점
          </span>
        </p>
        <p className={`hud text-[10px] text-menu ${compact ? 'mt-1' : 'mt-[7px] text-[11px]'}`}>
          종합점수
        </p>
        {caption && !compact && <p className="mt-[3px] text-xs text-menu">{caption}</p>}
      </div>
    </div>
  );
}
