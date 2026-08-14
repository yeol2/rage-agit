'use client';

import { useState } from 'react';
import { TIER_GROUPS, type TierGroup } from '@/lib/dashboardData';
import {
  RAGE_SCORE_STEEPNESS,
  eligibleForRanking,
  topByAvgKills,
  topByAvgRank,
  topByRageScore,
  type RankingStatsRow,
} from '@/lib/rankingStats';
import { siteConfig } from '@/lib/siteConfig';

// 점수는 "자기 고정 티어 밴드" 안에서 계산한다 — TIER_GROUPS 탭과 같은 경계다.
// "전체" 탭도 이 밴드별 점수를 그대로 모아 보여줄 뿐, 전체를 다시 묶어 계산하지 않는다.
const TIER_BANDS = TIER_GROUPS.filter((group) => group.tiers !== null).map((group) => group.tiers!);

// 사용자에게 보여줄 집계 기준 — 소프트맥스/z-score 같은 계산 방식은 여기 안 적는다.
const AGGREGATION_RULES = [
  '통산 12경기(내전 3회) 이상 참가한 클랜원만 집계',
  '최근 3개월 이내 내전 참가 기록이 없으면 제외',
  '종합점수: 매치당 등수점수+킬 합산 성적을 같은 티어 그룹 안에서 상대평가 (그룹 평균 = 50점)',
  '평균킬·평균등수: 매치당 평균 (부계정 포함)',
  '최근 12매치 = 가장 최근 내전 3회, 역대 전체 = 통산 전체 경기',
];

const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; height: string }> = [
  { rank: 2, order: 'order-1', height: 'h-44' },
  { rank: 1, order: 'order-2', height: 'h-56' },
  { rank: 3, order: 'order-3', height: 'h-40' },
];

type Metric = 'rageScore' | 'avgRank' | 'avgKills';
type Window = 'recent12' | 'alltime';

const METRIC_OPTIONS: Array<{ id: Metric; label: string }> = [
  { id: 'rageScore', label: '종합점수' },
  { id: 'avgRank', label: '평균등수' },
  { id: 'avgKills', label: '평균킬' },
];

const WINDOW_OPTIONS: Array<{ id: Window; label: string }> = [
  { id: 'alltime', label: '역대 전체' },
  { id: 'recent12', label: '최근 12매치' },
];

export interface TierRankingPodiumProps {
  recent12: RankingStatsRow[];
  alltime: RankingStatsRow[];
}

function formatMetricValue(
  metric: Metric,
  row: { avgKills: number; avgRank: number; windowGameCount: number; score?: number },
): { main: string; detail: string | null } {
  if (metric === 'avgKills') {
    const totalKills = Math.round(row.avgKills * row.windowGameCount);
    return {
      main: `${row.avgKills.toFixed(2)}킬`,
      detail: `(${totalKills}킬/${row.windowGameCount}경기)`,
    };
  }
  if (metric === 'avgRank') {
    return { main: `${row.avgRank.toFixed(1)}등`, detail: `(${row.windowGameCount}경기)` };
  }
  return { main: `${(row.score ?? 0).toFixed(1)}점`, detail: null };
}

function MetricValue({
  metric,
  row,
  className,
  detailClassName,
  stacked = false,
}: {
  metric: Metric;
  row: { avgKills: number; avgRank: number; windowGameCount: number; score?: number };
  className: string;
  detailClassName: string;
  stacked?: boolean;
}) {
  const { main, detail } = formatMetricValue(metric, row);
  if (stacked) {
    return (
      <span className="flex flex-col items-center">
        <span className={className}>{main}</span>
        {detail && <span className={detailClassName}>{detail}</span>}
      </span>
    );
  }
  return (
    <span className={className}>
      {main}
      {detail && <span className={detailClassName}> {detail}</span>}
    </span>
  );
}

function toggleButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent px-4 py-2 text-sm font-bold text-background'
    : 'rounded-full border border-white/15 px-4 py-2 text-sm text-menu transition-colors hover:text-foreground';
}

export function TierRankingPodium({ recent12, alltime }: TierRankingPodiumProps) {
  const [activeMetric, setActiveMetric] = useState<Metric>('rageScore');
  const [activeWindow, setActiveWindow] = useState<Window>('recent12');
  const [activeGroupId, setActiveGroupId] = useState<TierGroup['id']>(TIER_GROUPS[0].id);

  const activeGroup = TIER_GROUPS.find((group) => group.id === activeGroupId) ?? TIER_GROUPS[0];
  const rows = activeWindow === 'recent12' ? recent12 : alltime;
  const eligible = eligibleForRanking(rows);
  const groupRows =
    activeGroup.tiers === null
      ? eligible
      : eligible.filter((row) => activeGroup.tiers!.includes(row.tier));

  const top10 =
    activeMetric === 'rageScore'
      ? topByRageScore(groupRows, TIER_BANDS, RAGE_SCORE_STEEPNESS, 10)
      : activeMetric === 'avgRank'
        ? topByAvgRank(groupRows, 10)
        : topByAvgKills(groupRows, 10);
  const top = top10.slice(0, 3);
  const restRanked = top10.slice(3, 10);

  return (
    <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">
          {siteConfig.dashboard.tierRanking.eyebrow}
        </p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
        {siteConfig.dashboard.tierRanking.heading}
      </h2>

      <div className="mt-6 max-w-md rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs font-bold text-menu">📌 집계 기준</p>
        <ul className="mt-2 space-y-1 text-xs text-menu">
          {AGGREGATION_RULES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === activeMetric}
            onClick={() => setActiveMetric(option.id)}
            className={toggleButtonClass(option.id === activeMetric)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === activeWindow}
            onClick={() => setActiveWindow(option.id)}
            className={toggleButtonClass(option.id === activeWindow)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="티어 그룹" className="mt-6 flex flex-wrap gap-2">
        {TIER_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={group.id === activeGroupId}
            onClick={() => setActiveGroupId(group.id)}
            className={toggleButtonClass(group.id === activeGroupId)}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="mt-10 flex items-end justify-center gap-4">
        {PODIUM_SLOTS.map((slot) => {
          const member = top[slot.rank - 1];
          return (
            <div
              key={slot.rank}
              data-testid={`podium-slot-${slot.rank}`}
              className={`${slot.order} ${slot.height} flex w-full max-w-[180px] flex-col items-center justify-end rounded-t-lg border border-white/10 bg-white/[0.03] px-4 pb-6`}
            >
              <p className={`text-xl font-bold ${member ? 'text-accent' : 'text-accent/30'}`}>
                {slot.rank}
              </p>
              {member ? (
                <>
                  <p className="mt-2 max-w-full truncate text-base font-bold text-foreground">
                    {member.discordNickname}
                  </p>
                  <p className="mt-1 text-xs text-menu">{member.tier}티어</p>
                  <p className="mt-2 tabular-nums">
                    <MetricValue
                      metric={activeMetric}
                      row={member}
                      className="text-lg font-bold text-foreground"
                      detailClassName="text-xs font-normal text-menu"
                      stacked
                    />
                  </p>
                </>
              ) : (
                <p className="mt-4 text-2xl text-white/20">—</p>
              )}
            </div>
          );
        })}
      </div>

      {restRanked.length > 0 && (
        <div className="mx-auto mt-6 max-w-md space-y-2">
          {restRanked.map((member, index) => (
            <div
              key={member.memberId}
              data-testid={`ranking-row-${index + 4}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-sm font-bold text-menu">{index + 4}</span>
                <span className="truncate text-sm font-bold text-foreground">
                  {member.discordNickname}
                </span>
                <span className="text-xs text-menu">{member.tier}티어</span>
              </div>
              <span className="tabular-nums">
                <MetricValue
                  metric={activeMetric}
                  row={member}
                  className="text-sm font-bold text-foreground"
                  detailClassName="text-xs font-normal text-menu"
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
