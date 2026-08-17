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

// 피그마 원본은 시상대 3개가 모두 같은 크기(363.69 × 432.71)이고,
// 1위만 통째로 44.3px 위로 올라가 있다 — 높이 차이가 아니라 위치 차이다.
// 여기서는 1200px 셸에 맞춘 축척(0.809)으로 옮긴다.
const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; offset: string }> = [
  { rank: 2, order: 'order-1', offset: 'mt-9' },
  { rank: 1, order: 'order-2', offset: 'mt-0' },
  { rank: 3, order: 'order-3', offset: 'mt-9' },
];

// 피그마 Rectangle 1 의 세로 그라데이션(#252C41 → #0F1118 45% → #0E0F15)을
// 우리 색조로 옮긴 것. 위가 밝고 아래로 갈수록 배경색에 잠긴다.
const PEDESTAL_GRADIENT = 'linear-gradient(180deg, #262032 0%, #141019 45%, #110E16 100%)';

const MEDAL_SRC: Record<1 | 2 | 3, string> = {
  1: '/medals/gold.png',
  2: '/medals/silver.png',
  3: '/medals/bronze.png',
};

function TrophyBadge({ rank }: { rank: 1 | 2 | 3 }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-md ${
        rank === 1 ? 'bg-accent' : 'bg-white/10'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
          stroke={rank === 1 ? '#0E0B13' : '#FFFFFF'}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3"
          stroke={rank === 1 ? '#0E0B13' : '#FFFFFF'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 12v3m-3 3h6m-3 0v-3"
          stroke={rank === 1 ? '#0E0B13' : '#FFFFFF'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

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
    ? 'rounded-full bg-accent/15 px-4 py-2 text-sm font-bold text-accent'
    : 'rounded-full bg-white/[0.03] px-4 py-2 text-sm text-menu transition-colors hover:bg-white/[0.06] hover:text-foreground';
}

// 원본 Frame 1(선택된 알약): 모서리 8.24 / 좌우 패딩 24.73 / 상하 8.24.
function windowButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-lg bg-accent/20 px-6 py-2 text-sm font-bold text-accent'
    : 'rounded-lg px-6 py-2 text-sm text-menu transition-colors hover:text-foreground';
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

  const RANKING_SIZE = activeGroup.tiers === null ? 30 : 10;
  const topRanked =
    activeMetric === 'rageScore'
      ? topByRageScore(groupRows, TIER_BANDS, RAGE_SCORE_STEEPNESS, RANKING_SIZE)
      : activeMetric === 'avgRank'
        ? topByAvgRank(groupRows, RANKING_SIZE)
        : topByAvgKills(groupRows, RANKING_SIZE);
  const top = topRanked.slice(0, 3);
  const restRanked = topRanked.slice(3, RANKING_SIZE);

  return (
    <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
      <div className="flex flex-col items-center text-center">
        <p className="hud text-[11px] text-accent sm:text-xs">
          {siteConfig.dashboard.tierRanking.eyebrow}
        </p>
        <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
          {siteConfig.dashboard.tierRanking.heading}
        </h2>
      </div>

      <div className="mt-8 flex justify-center">
        {/* 원본 Frame 3(토글 트랙): 모서리 12.36 / 패딩 4.12 / 안쪽 그림자 */}
        <div
          role="tablist"
          aria-label="집계 창"
          className="inline-flex gap-1 rounded-xl p-1"
          style={{
            background: '#1A1520',
            boxShadow: 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.45)',
          }}
        >
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === activeWindow}
              onClick={() => setActiveWindow(option.id)}
              className={windowButtonClass(option.id === activeWindow)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
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

      <div role="tablist" aria-label="티어 그룹" className="mt-4 flex flex-wrap justify-center gap-2">
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

      <div className="mx-auto mt-12 flex max-w-4xl items-start justify-center gap-2 sm:gap-[3%]">
        {PODIUM_SLOTS.map((slot) => {
          const member = top[slot.rank - 1];
          return (
            <div
              key={slot.rank}
              data-testid={`podium-slot-${slot.rank}`}
              className={`${slot.order} ${slot.offset} flex min-w-0 flex-1 flex-col items-center`}
            >
              {/* 메달 — 원본의 아바타 자리(Frame 10/11/12 첫 칸).
                  뒤에 원본 Ellipse 2/3/4 의 발광 원(85.51 → 69px)을 깐다. */}
              <span className="relative flex h-16 items-center justify-center sm:h-[76px]">
                {member && (
                  <span
                    aria-hidden="true"
                    className="absolute h-[69px] w-[69px] rounded-full blur-[22px]"
                    style={{ background: 'rgba(255, 146, 51, 0.45)' }}
                  />
                )}
                {member ? (
                  <img
                    src={MEDAL_SRC[slot.rank]}
                    alt={`${slot.rank}위`}
                    className="relative h-16 w-auto sm:h-[76px]"
                  />
                ) : (
                  <span className="text-xl font-bold text-accent/30">{slot.rank}</span>
                )}
              </span>

              {/* 이름 — 원본에서도 시상대 바깥, 아바타 바로 아래에 있다. */}
              <p className="mt-3 max-w-full truncate text-base font-bold text-foreground sm:text-lg">
                {member ? member.discordNickname : '—'}
              </p>

              {/* 시상대 — 원본 Group 1~3. 셋 다 같은 크기다. */}
              <div
                className="mt-3 flex h-[280px] w-full flex-col items-center border border-white/[0.07] px-2 pt-5 sm:h-[350px] sm:px-4"
                style={{ background: PEDESTAL_GRADIENT }}
              >
                {member && (
                  <>
                    <TrophyBadge rank={slot.rank} />
                    <p className="mt-2 text-xs text-menu">{member.tier}티어</p>

                    {/* 원본 Vector 2 — 시상대 안쪽 가로 구분선(흰색 7%) */}
                    <span aria-hidden="true" className="mt-4 h-px w-[89%] bg-white/[0.07]" />

                    <p className="mt-5 tabular-nums">
                      <MetricValue
                        metric={activeMetric}
                        row={member}
                        className="text-xl font-bold text-foreground sm:text-2xl"
                        detailClassName="text-xs font-normal text-menu"
                        stacked
                      />
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 원본 Vector 3 — 시상대와 표 사이의 구분선. 폭 517.2(콘텐츠의 43%)이고
          선형 그라데이션이라 양끝이 서서히 사라진다. */}
      <div
        aria-hidden="true"
        className="mx-auto mt-12 h-px w-[43%]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)',
        }}
      />

      {restRanked.length > 0 && (
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="flex items-center gap-3 px-4 pb-2 text-xs text-white/60">
            <span className="w-8">등수</span>
            <span className="flex-1">닉네임</span>
            <span className="w-24 text-right">
              {METRIC_OPTIONS.find((o) => o.id === activeMetric)?.label}
            </span>
          </div>

          {/*
            원본 Frame 29(표 한 줄): 채우기 #171C29 / 모서리 12.36 / 패딩 16.48 x 6.18.
            줄마다 배경이 깔린 알약 모양이고, 구분선은 쓰지 않는다.
          */}
          <div className="space-y-1">
            {restRanked.map((member, index) => (
              <div
                key={member.memberId}
                data-testid={`ranking-row-${index + 4}`}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{ background: '#17131F' }}
              >
                <span className="w-8 text-sm font-bold text-menu">{index + 4}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-bold text-foreground">
                    {member.discordNickname}
                  </span>
                  <span className="shrink-0 text-xs text-menu">{member.tier}티어</span>
                </span>
                <span className="w-24 text-right tabular-nums">
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

          <p className="mt-3 text-right text-xs text-menu">
            총 {groupRows.length}명 중 {topRanked.length}명
          </p>
        </div>
      )}

      <div className="mx-auto mt-16 max-w-4xl border-l-2 border-accent bg-accent/[0.08] px-5 py-4">
        <p className="hud text-[11px] font-bold text-accent">집계 기준</p>
        <ul className="mt-3 space-y-1.5 text-xs text-menu">
          {AGGREGATION_RULES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                ·
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
