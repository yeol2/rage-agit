'use client';

import { useState } from 'react';
import { MEMBERS, TIER_GROUPS, getTopMembers, type Member, type TierGroup } from '@/lib/dashboardData';
import { siteConfig } from '@/lib/siteConfig';

const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; height: string }> = [
  { rank: 2, order: 'order-1', height: 'h-44' },
  { rank: 1, order: 'order-2', height: 'h-56' },
  { rank: 3, order: 'order-3', height: 'h-40' },
];

export function TierRankingPodium({ members = MEMBERS }: { members?: Member[] } = {}) {
  const [activeGroupId, setActiveGroupId] = useState<TierGroup['id']>(TIER_GROUPS[0].id);
  const activeGroup = TIER_GROUPS.find((group) => group.id === activeGroupId) ?? TIER_GROUPS[0];
  const top = getTopMembers(members, activeGroup);

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

      <div role="tablist" aria-label="티어 그룹" className="mt-8 flex flex-wrap gap-2">
        {TIER_GROUPS.map((group) => {
          const selected = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveGroupId(group.id)}
              className={
                selected
                  ? 'rounded-full bg-accent px-4 py-2 text-sm font-bold text-background'
                  : 'rounded-full border border-white/15 px-4 py-2 text-sm text-menu transition-colors hover:text-foreground'
              }
            >
              {group.label}
            </button>
          );
        })}
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
                    {member.ign}
                  </p>
                  {activeGroup.tiers === null && (
                    <p className="mt-1 text-xs text-menu">{member.tier}티어</p>
                  )}
                  <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                    {member.score.toFixed(1)}
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
