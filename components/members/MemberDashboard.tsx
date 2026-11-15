'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ScoreRing } from '@/components/members/ScoreRing';
import { SessionStandingChips } from '@/components/members/SessionStandingChips';
import { ScoreTrend, TREND_GUTTER_PX } from '@/components/members/ScoreTrend';
import { centeredPercent, type DashboardWindowStats, type RecentSession } from '@/lib/memberDashboard';
import type { TierColorRamp } from '@/lib/memberStats';
import { SCRIM_LABEL } from '@/lib/scrimCounting';
import type { SeriesPoint } from '@/lib/scoreHistory';

type Window = 'alltime' | 'recent16';

// 리더보드 상단 토글과 같은 말·같은 순서를 쓴다 — 두 화면에서 다른 이름으로
// 부르면 같은 값인지 알 수 없다.
const WINDOW_OPTIONS: Array<{ id: Window; label: string }> = [
  { id: 'alltime', label: SCRIM_LABEL.allTime },
  { id: 'recent16', label: SCRIM_LABEL.recentWindow },
];

function windowButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-lg bg-white/10 px-4 py-1.5 text-sm font-bold text-white'
    : 'rounded-lg px-4 py-1.5 text-sm text-menu transition-colors hover:text-foreground';
}

function StatCard({
  label,
  value,
  unit,
  detail,
  percent,
  scaleLow,
  scaleMid,
  scaleHigh,
  ramp,
  compact,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  percent: number;
  scaleLow: string;
  scaleMid: string;
  scaleHigh: string;
  ramp: TierColorRamp;
  compact: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col justify-center rounded-2xl border border-white/[0.06] bg-[#1B1B23] text-center ${
        compact ? 'px-3 py-3.5' : 'px-4 py-[18px]'
      }`}
    >
      <p className="hud mb-0.5 text-[11px] text-menu">{label}</p>
      <p
        className={`font-bold leading-tight tracking-tight tabular-nums ${compact ? 'text-2xl' : 'text-3xl'}`}
      >
        {value}
        <span className="ml-px text-[15px] font-bold text-white/70">{unit}</span>
      </p>
      <p className="text-xs text-menu tabular-nums">{detail}</p>

      {/* 막대 한가운데(|)가 티어 그룹 평균이다 — 링 게이지의 50점 점과 같은 뜻이라
          세 지표 모두 "가운데를 넘으면 평균 이상"으로 읽힌다. */}
      <div className="relative mt-4 h-1.5 rounded-full bg-white/[0.07]">
        <span
          className="absolute inset-y-0 left-0 block rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${ramp.from}, ${ramp.to})`,
          }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 left-1/2 -ml-px w-0.5 rounded-sm bg-white/75"
          style={{ boxShadow: '0 0 0 2px rgba(14,11,19,0.9)' }}
        />
      </div>

      <div className="mt-[7px] flex justify-between text-[10px] text-subtext">
        <span>{scaleLow}</span>
        <span className="font-bold text-menu">{scaleMid}</span>
        <span>{scaleHigh}</span>
      </div>
    </div>
  );
}

export interface MemberDashboardProps {
  stats: Record<Window, DashboardWindowStats | null>;
  sessions: RecentSession[];
  standingByDate: Map<string, number>;
  ramp: TierColorRamp;
  /** 리더보드 드롭다운용 — 링을 줄이고, 창 토글은 리더보드 상단 것을 따라가므로 뺀다. */
  compact?: boolean;
  /** compact 일 때 바깥(리더보드)이 정한 창. */
  window?: Window;
  /**
   * 내전별 점수(쉰 날은 이어 그린 값). 주면 점수 변동 그래프를 그린다 — 리더보드는
   * 칩 아래에 최근 10회만, 상세 페이지는 전적 요약 다음 칸에 최근 10회/전체 토글로.
   * 그래프는 위에서 고른 집계 창을 따라가서 끝점이 링의 점수와 같다.
   */
  scoreSeries?: SeriesPoint[];
}

export function MemberDashboard({
  stats,
  sessions,
  standingByDate,
  ramp,
  compact = false,
  window: forcedWindow,
  scoreSeries,
}: MemberDashboardProps) {
  const [ownWindow, setOwnWindow] = useState<Window>('alltime');
  const activeWindow = compact ? (forcedWindow ?? 'recent16') : ownWindow;
  const current = stats[activeWindow];
  // 리더보드 칸은 종합점수가 있을 때만(자격 미달이면 링도 없다), 상세 페이지는 늘.
  const showTrend: boolean = scoreSeries !== undefined && (compact ? current !== null : true);

  // 좁은 화면(휴대폰)에서는 칩 줄도 그래프도 옆으로 스크롤된다. 한쪽을 밀면 다른
  // 쪽도 같은 만큼 밀어서 칩 가운데와 그래프 점이 계속 세로로 맞게 한다. 두 칸의
  // 스크롤 가능한 길이는 같다(칩 쪽 왼쪽 여백 = 그래프 눈금 칸, 칩·점 최소 폭도 같다).
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const trendScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const a = chipsScrollRef.current;
    const b = trendScrollRef.current;
    if (!a || !b) return;
    const follow = (from: HTMLDivElement, to: HTMLDivElement) => () => {
      // 그래프가 "전체" 보기면 칩과 칸이 안 맞으므로 묶지 않는다.
      if (b.dataset.scrollLinked !== 'true') return;
      // 이미 같은 자리면 건드리지 않는다 — 서로를 계속 다시 미는 걸 막는다.
      if (Math.abs(to.scrollLeft - from.scrollLeft) >= 1) to.scrollLeft = from.scrollLeft;
    };
    const onA = follow(a, b);
    const onB = follow(b, a);
    a.addEventListener('scroll', onA, { passive: true });
    b.addEventListener('scroll', onB, { passive: true });
    // 그래프가 묶이기 전에 먼저 오른쪽 끝(최근 회차)으로 가 있었을 수 있다 — 한 번 맞춘다.
    a.scrollLeft = b.scrollLeft;
    return () => {
      a.removeEventListener('scroll', onA);
      b.removeEventListener('scroll', onB);
    };
  }, [showTrend, activeWindow]);
  const gradientId = useId().replace(/:/g, '');

  return (
    <div data-testid="member-dashboard">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 칸 제목은 세 칸(전적 요약·팀 궁합·6각형 지표)이 같은 모양이다. 예전엔
              11px 회색이라 칸 안의 라벨들과 구분이 안 돼서, 어디서 어디까지가 한
              칸인지 스크롤하며 세어야 했다. */}
          <p className="hud text-sm font-bold text-foreground">전적 요약</p>
          <div
            role="tablist"
            aria-label="집계 창"
            className="inline-flex rounded-xl bg-white/[0.03] p-0.5"
          >
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === activeWindow}
                onClick={() => setOwnWindow(option.id)}
                className={windowButtonClass(option.id === activeWindow)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {current === null ? (
        // 리더보드 자격(통산 16경기·최근 3개월)에 못 미치면 "그룹 몇 위"가 성립하지
        // 않는다. 빈 게이지를 그리는 대신 이유를 적는다.
        <p className="mt-4 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 py-8 text-center text-sm text-menu">
          아직 집계 기준(통산 16경기·최근 3개월 참가)에 못 미쳐 종합점수가 없습니다.
        </p>
      ) : (
        <div
          className={`mt-3.5 grid gap-2.5 ${
            compact
              ? 'grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]'
              : 'grid-cols-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]'
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-2xl border border-white/[0.06] bg-[#1B1B23] p-3.5 ${
              compact ? '' : 'col-span-2 sm:col-span-1'
            }`}
          >
            <ScoreRing
              score={current.score}
              ramp={ramp}
              compact={compact}
              gradientId={`ring-${gradientId}`}
              caption={`${current.groupLabel} 중 ${current.scoreRank}등`}
            />
          </div>

          <StatCard
            label="평균등수"
            value={current.avgRank.toFixed(1)}
            unit="등"
            detail={`${current.games}경기`}
            percent={centeredPercent(
              current.avgRank,
              current.groupAvgRank,
              current.groupRankSpread,
              false,
            )}
            scaleLow="16등"
            scaleMid={`평균 ${current.groupAvgRank.toFixed(1)}등`}
            scaleHigh="1등"
            ramp={ramp}
            compact={compact}
          />

          <StatCard
            label="평균킬"
            value={current.avgKills.toFixed(2)}
            unit="킬"
            detail={`${current.totalKills}킬 / ${current.games}경기`}
            percent={centeredPercent(
              current.avgKills,
              current.groupAvgKills,
              current.groupKillsSpread,
              true,
            )}
            scaleLow="적음"
            scaleMid={`평균 ${current.groupAvgKills.toFixed(2)}킬`}
            scaleHigh="많음"
            ramp={ramp}
            compact={compact}
          />
        </div>
      )}

      {sessions.length > 0 && (
        <div
          className={`mt-2.5 rounded-2xl border border-white/[0.06] p-4 ${
            compact ? 'bg-white/[0.02]' : 'bg-[#1B1B23]'
          }`}
        >
          <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
            <p className="hud text-[11px] text-menu">최근 {sessions.length}회 내전 종합등수</p>
            <span className="text-[11px] text-subtext">오래된 것 → 최근</span>
          </div>
          <SessionStandingChips
            sessions={sessions}
            standingByDate={standingByDate}
            compact={compact}
            leftGutter={showTrend ? TREND_GUTTER_PX : 0}
            scrollRef={chipsScrollRef}
          />
        </div>
      )}

      {/* 점수 변동 — 칩 카드와 같은 안쪽 여백(p-4)이라 그래프 점이 칩 가운데와 세로로 맞는다.
          상세 페이지에서는 전적 요약 다음, 맵별 기록 앞의 카드 하나다. */}
      {showTrend && scoreSeries && (
        <div
          className={`rounded-2xl border border-white/[0.06] p-4 ${
            compact ? 'mt-2.5 bg-white/[0.02]' : 'mt-4 bg-[#1B1B23]'
          }`}
        >
          <ScoreTrend
            series={scoreSeries}
            // 링에 보이는 점수 그대로 — 그래프 끝점이 화면 숫자와 늘 같다.
            liveScores={{ alltime: stats.alltime?.score ?? null, recent16: stats.recent16?.score ?? null }}
            window={activeWindow}
            ramp={ramp}
            compact={compact}
            alignDates={sessions.map((s) => s.scrimDate)}
            standingByDate={standingByDate}
            scrollRef={trendScrollRef}
          />
        </div>
      )}
    </div>
  );
}
