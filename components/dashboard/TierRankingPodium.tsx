'use client';

import { useState } from 'react';
import { TIER_GROUPS, type TierGroup } from '@/lib/dashboardData';
import {
  WIN_PROBABILITY_TEMPERATURE,
  eligibleForRanking,
  topByAvgKills,
  topByWinProbability,
  type RankingStatsRow,
} from '@/lib/rankingStats';
import { siteConfig } from '@/lib/siteConfig';

const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; height: string }> = [
  { rank: 2, order: 'order-1', height: 'h-44' },
  { rank: 1, order: 'order-2', height: 'h-56' },
  { rank: 3, order: 'order-3', height: 'h-40' },
];

type Metric = 'winProbability' | 'avgKills';
type Window = 'recent10' | 'alltime';

const METRIC_OPTIONS: Array<{ id: Metric; label: string }> = [
  { id: 'winProbability', label: '우승확률' },
  { id: 'avgKills', label: '평균킬' },
];

const WINDOW_OPTIONS: Array<{ id: Window; label: string }> = [
  { id: 'recent10', label: '최근 10경기' },
  { id: 'alltime', label: '역대 전체' },
];

export interface TierRankingPodiumProps {
  recent10: RankingStatsRow[];
  alltime: RankingStatsRow[];
}

function formatMetricValue(metric: Metric, row: { avgKills: number; probability?: number }): string {
  if (metric === 'avgKills') return `${row.avgKills.toFixed(1)}킬`;
  return `${((row.probability ?? 0) * 100).toFixed(1)}%`;
}

function toggleButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent px-4 py-2 text-sm font-bold text-background'
    : 'rounded-full border border-white/15 px-4 py-2 text-sm text-menu transition-colors hover:text-foreground';
}

export function TierRankingPodium({ recent10, alltime }: TierRankingPodiumProps) {
  const [activeMetric, setActiveMetric] = useState<Metric>('winProbability');
  const [activeWindow, setActiveWindow] = useState<Window>('recent10');
  const [activeGroupId, setActiveGroupId] = useState<TierGroup['id']>(TIER_GROUPS[0].id);

  const activeGroup = TIER_GROUPS.find((group) => group.id === activeGroupId) ?? TIER_GROUPS[0];
  const rows = activeWindow === 'recent10' ? recent10 : alltime;
  const eligible = eligibleForRanking(rows);
  const groupRows =
    activeGroup.tiers === null
      ? eligible
      : eligible.filter((row) => activeGroup.tiers!.includes(row.tier));

  const top =
    activeMetric === 'winProbability'
      ? topByWinProbability(groupRows, WIN_PROBABILITY_TEMPERATURE, 3)
      : topByAvgKills(groupRows, 3);

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
                  {activeGroup.tiers === null && (
                    <p className="mt-1 text-xs text-menu">{member.tier}티어</p>
                  )}
                  <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                    {formatMetricValue(activeMetric, member)}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-2xl text-white/20">—</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
