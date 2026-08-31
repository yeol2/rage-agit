'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { TROPHY_VIEWBOX, TrophyGoldGradient, TrophyPaths } from '@/components/TrophyGlyph';
import { WinBadge } from '@/components/WinBadge';
import { TIER_GROUPS, type TierGroup } from '@/lib/dashboardData';
import { formatCountdown, nextScrimDate } from '@/lib/nextScrim';
import {
  RAGE_SCORE_STEEPNESS,
  TIER_SCORE_BANDS,
  eligibleForRanking,
  rageScores,
  topByAvgKills,
  topByAvgRank,
  topByRageScore,
  type RankingStatsRow,
} from '@/lib/rankingStats';
import { computeRankChange, type RankingSnapshotRow } from '@/lib/rankingSnapshot';
import { MemberDashboard } from '@/components/members/MemberDashboard';
import {
  buildWindowStats,
  standingsByMember,
  type RecentSession,
  type SessionStanding,
} from '@/lib/memberDashboard';
import { tierColorRamp, tierNameplateStyle } from '@/lib/memberStats';
import { siteConfig } from '@/lib/siteConfig';
import { useAdmin } from '@/components/admin/AdminProvider';

// 사용자에게 보여줄 집계 기준 — 소프트맥스/z-score 같은 계산 방식은 여기 안 적는다.
const AGGREGATION_RULES = [
  '통산 16경기(내전 4회) 이상 참가한 클랜원만 집계',
  '최근 3개월 이내 내전 참가 기록이 없으면 제외',
  '종합점수: 매치당 등수점수+킬 합산 성적을 같은 티어 그룹 안에서 상대평가 (그룹 평균 = 50점)',
  '평균킬·평균등수: 매치당 평균 (부계정 포함)',
  '최근 16매치 = 본인이 참여한 가장 최근 내전 4회, 역대 전체 = 40시즌부터 통산 전체 경기',
];

// 시상대 3개는 크기가 완전히 같고, 1위만 통째로 위로 올라가 있다 —
// 높이 차이가 아니라 위치 차이다(`offset`).
const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; offset: string }> = [
  { rank: 2, order: 'order-1', offset: 'mt-9' },
  { rank: 1, order: 'order-2', offset: 'mt-0' },
  { rank: 3, order: 'order-3', offset: 'mt-9' },
];

// 시상대 박스는 윗면(사다리꼴)과 정면 두 겹으로 3D 느낌을 낸다.
//
// 색은 채도를 거의 뺀 그래파이트다. 예전엔 보라/남색이 섞여 배경(#0E0B13)과
// 겉돌았는데, 중립 회색으로 낮추니 배경에 자연스럽게 얹히고 금색 트로피와
// 주황 강조색이 훨씬 또렷하게 살아난다 — 박스는 무대, 색은 트로피에 양보.
//
// 👉 박스 정면 색 조절은 여기(PEDESTAL_GRADIENT): 3단 그라데이션 문자열의
// 앞쪽 두 hex 가 조절 대상이다. 세 번째 값은 tailwind.config.ts 의 `background`
// 토큰과 맞춰야 아래로 갈수록 배경에 자연스럽게 잠긴다.
const PEDESTAL_GRADIENT = 'linear-gradient(180deg, #21212A 0%, #17171E 55%, #0E0B13 100%)';
// 👉 박스 윗면(사다리꼴) 색 조절은 여기. 정면 시작색보다 한 톤 밝아야 빛을 받는
// 윗면으로 읽힌다.
const PEDESTAL_TOP_COLOR = '#2B2B33';

// 4위 이하 표의 열 정의 — 등수 / 닉네임 / 티어 / 뱃지 / 점수 / 변동.
// 헤더와 각 행이 **같은 문자열**을 쓰기 때문에 열이 서로 어긋날 수 없다.
// 예전엔 flex + 개별 w- 값이라 티어가 닉네임 옆에 붙어 다니고 열이 안 맞았다.
//
// 앞 네 칸(등수/닉네임/티어/뱃지)은 **지표를 바꿔도 자리가 그대로**여야 한다.
// 그래서 점수 칸은 가장 긴 지표(평균킬 `2.50킬 (210킬/20경기)` = 130px)에 맞춘
// 고정폭이고, 짧은 지표에서 칸이 남는 문제는 폭을 줄이는 대신 **콘텐츠를 우측
// 정렬**해서 푼다 — 값이 항상 칸 오른쪽 끝(= 변동 칸 바로 옆)에 붙으므로 남는
// 공간이 왼쪽으로 가고, 칸 폭은 건드릴 필요가 없다.
//
// 모바일은 폭이 빠듯하다. 375px 화면에서 표가 실제로 쓸 수 있는 폭은 303px
// (화면 375 − 섹션 좌우 40 − 행 좌우 32)인데, 고정 칸과 칸사이간격을 합치면
// 그만큼을 다 먹어버려서 1fr 인 닉네임이 0 으로 눌린다 — 닉네임이 아예 안 보였다.
// 그래서 모바일에서만 고정 칸을 조이고 간격도 좁힌다.
//   24 + 52 + 48 + 64 + 24 = 212, 간격 5 × 4 = 20 → 232 (닉네임 71px 확보)
// 티어 칸 52px 는 배지 실측폭(51px)에서 나온 값이라 더는 못 줄인다.
//
// 뱃지 칸(데스크탑 160px)은 지금 트로피 하나에 비하면 넓다. 일부러 그렇게
// 둔다 — 이 표가 클랜에서 뱃지가 가장 많이 붙는 자리라, 종합우승 말고 다른
// 뱃지가 생기면 이 칸에 왼쪽부터 하나씩 채워진다. 칸을 트로피 하나에 맞춰
// 조였다가 뱃지가 늘 때마다 다시 넓히면 그때마다 표 전체가 흔들린다.
const RANKING_GRID =
  'grid grid-cols-[1.5rem_1fr_3.25rem_3rem_4rem_1.5rem] items-center gap-1 sm:grid-cols-[3rem_1fr_5rem_10rem_8.25rem_1.75rem] sm:gap-3';

// 변동은 종합점수에서만 계산한다. 평균등수/평균킬 탭에서는 변동 칸을 아예 만들지
// 않고 **마지막 두 칸을 하나로 합쳐** 점수가 박스 오른쪽 끝까지 쓰게 한다.
// 합친 폭 = 점수 + 칸사이간격 + 변동 이라 고정폭 총합이 위와 똑같고, 그래서
// 남는 폭을 먹는 닉네임(1fr) 도 그대로다 — 앞 네 칸 위치가 탭을 바꿔도 안 흔들린다.
//   데스크탑: 8.25rem + 12px + 1.75rem = 10.75rem
//   모바일  : 4rem    +  4px + 1.5rem  =  5.75rem
const RANKING_GRID_NO_CHANGE =
  'grid grid-cols-[1.5rem_1fr_3.25rem_3rem_5.75rem] items-center gap-1 sm:grid-cols-[3rem_1fr_5rem_10rem_10.75rem] sm:gap-3';

// 점수 헤더를 칸 오른쪽 끝에서 살짝 띄우는 공백. 일반 공백은 HTML 이 줄 끝에서
// 지워버리므로 non-breaking space 를 쓴다.
const HEADER_TRAILING_SPACE = String.fromCharCode(160); // U+00A0

// 뱃지 열 트로피가 쓰는 그라디언트. 표에 수십 줄이 깔리므로 정의는 문서에
// 하나만 두고 모든 줄이 이 id 를 가리킨다.
const RANKING_TROPHY_GOLD = 'ranking-trophy-gold';

// 티어를 맨 글자가 아니라 둥근 배지로 보여준다 — team-builder 네임플레이트와
// 같은 배색 함수(tierNameplateStyle)를 그대로 가져다 쓴다(새 색을 만들지
// 않는다, lib/memberStats.ts 가 티어 색의 유일한 출처).
function TierBadge({ tier, className = '' }: { tier: number; className?: string }) {
  const style = tierNameplateStyle(tier);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${className}`}
      style={{
        background: style.background,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color,
      }}
    >
      {tier}티어
    </span>
  );
}

// 직전 등수 스냅샷 대비 상승/하락/신규를 보여준다. 종합점수 탭에서만 쓴다.
// 상승=초록, 하락=빨강(사용자 지정). 신규(NEW)는 그 둘과 안 겹치는 네온
// 시안으로 — 상승 색(초록)과 같이 쓰면 "새로 올라온 건지 오른 건지" 헷갈린다.
function RankChangeBadge({
  current,
  previous,
  className = '',
}: {
  current: number;
  previous: number | undefined;
  className?: string;
}) {
  const change = computeRankChange(current, previous);
  if (!change) {
    return <span className={`text-xs text-menu ${className}`}>-</span>;
  }
  if (change.type === 'new') {
    return (
      <span
        className={`text-[10px] font-bold ${className}`}
        style={{ color: '#39E5FF', textShadow: '0 0 6px rgba(57,229,255,0.8)' }}
      >
        NEW
      </span>
    );
  }
  const isUp = change.type === 'up';
  return (
    <span className={`text-xs font-bold ${isUp ? 'text-green-400' : 'text-red-400'} ${className}`}>
      {isUp ? '▲' : '▼'}
      {change.delta}
    </span>
  );
}

// 표 한 줄의 배경. 시상대 박스(PEDESTAL_GRADIENT)와 같은 그래파이트 계열로 맞췄다.
const RANKING_ROW_BG = '#1B1B23';

// 순위별 트로피 배지 색 — 1위 금색은 사용자가 지정한 #FFD365 다.
// 2·3위는 같은 배지를 은/동으로 낮춘 것(순위가 색으로도 읽히게).
const TROPHY_COLORS: Record<1 | 2 | 3, { bg: string; icon: string }> = {
  1: { bg: '#FFD365', icon: '#5A4413' },
  2: { bg: '#CDCDCD', icon: '#44464A' },
  3: { bg: '#B38A48', icon: '#3F2D11' },
};

// 박스 윗면·정면 경계에 절반 걸치는 둥근 사각 트로피 배지.
// 트로피 글리프 자체는 components/TrophyGlyph.tsx 에 있다(클랜원 화면과 공용).
function TrophySquare({ rank }: { rank: 1 | 2 | 3 }) {
  const { bg, icon } = TROPHY_COLORS[rank];
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11"
      style={{ background: bg, boxShadow: '0 8px 20px 0 rgba(0, 0, 0, 0.35)' }}
    >
      <svg viewBox={TROPHY_VIEWBOX} fill={icon} className="h-5 w-5 sm:h-[22px] sm:w-[22px]">
        <TrophyPaths />
      </svg>
    </span>
  );
}

// 아바타 자리의 더미 이미지 — 실제 프로필 사진이 없어서 참고 이미지의 인물 사진 위치에
// 넣는 자리표시자(placeholder) 아이콘이다. 멤버별로 다르지 않고 고정 그림이다.
function DummyAvatar() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.06] sm:h-20 sm:w-20">
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9 text-white/25 sm:h-10 sm:w-10">
        <circle cx="12" cy="8.5" r="4" fill="currentColor" />
        <path d="M4 20c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5" fill="currentColor" />
      </svg>
    </div>
  );
}

// 카운트다운의 알람 시계 아이콘. 참고 이미지처럼 몸통은 꽉 채우고 종·다리·바늘만
// 남겨서 트로피 배지와 같은 solid 느낌으로 맞췄다.
function ClockIcon() {
  return (
    <svg viewBox="1.5 1.5 21 21" fill="none" className="h-7 w-7 text-accent">
      {/* 종(윗부분 좌우) */}
      <path
        d="M4.2 4.6 6.6 2.6M19.8 4.6 17.4 2.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 다리 */}
      <path
        d="M6.6 19.6 5.1 21.6M17.4 19.6 18.9 21.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 몸통 */}
      <circle cx="12" cy="13" r="8.2" fill="currentColor" />
      {/* 바늘 — 몸통을 파내서 보이게 한다 */}
      <path
        d="M12 8.4v4.9l3.1 2"
        stroke="#0E0B13"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Metric = 'rageScore' | 'avgRank' | 'avgKills';
type Window = 'recent16' | 'alltime';

const METRIC_OPTIONS: Array<{ id: Metric; label: string }> = [
  { id: 'rageScore', label: '종합점수' },
  { id: 'avgRank', label: '평균등수' },
  { id: 'avgKills', label: '평균킬' },
];

const WINDOW_OPTIONS: Array<{ id: Window; label: string }> = [
  { id: 'alltime', label: '역대 전체' },
  { id: 'recent16', label: '최근 16매치' },
];

// 집계 창 토글 옆 물음표 아이콘에 띄울 설명. 문구만 고치면 말풍선에 그대로 반영된다.
const WINDOW_HELP: Array<{ term: string; desc: string }> = [
  { term: '역대 전체', desc: '40시즌부터 현재까지' },
  { term: '최근 16매치', desc: '최근 내전 4회 (본인이 참여한)' },
];

// "종합점수" 탭 옆 물음표 아이콘에 띄울 설명. 한 줄에 한 문장 — 배열 순서대로
// 줄바꿈되어 말풍선에 반영된다.
const RAGE_SCORE_HELP = [
  '같은 티어 그룹 안에서만 비교해요 (예: 2티어는 2~2.5티어 그룹 안에서)',
  '그룹 평균이면 50점, 잘할수록 100점에 가까워져요',
  '티어별로 킬 점수가 달라요 — 1티어 1킬 ≠ 4티어 1킬',
];

// 참여한 내전이 하나도 없는 사람도 칩 줄은 그려야 한다(전부 '-'). 매번 새 Map 을
// 만들면 MemberDashboard 가 계속 다시 그려지므로 빈 것 하나를 돌려 쓴다.
const EMPTY_STANDINGS: Map<string, number> = new Map();

// 펼친 패널의 뾰족한 꼭지가 시상대 어느 칸을 가리킬지 — 칸 중심의 가로 위치다.
// 시상대 줄은 `flex max-w-4xl` 에 `gap-[3%]` 인 세 칸(flex-1 basis-0)이라
// 한 칸 폭이 (100-6)/3 = 31.333% 이고, 중심은 각각 아래 값이 된다.
// 패널도 같은 max-w-4xl 이라 퍼센트가 그대로 맞아떨어진다.
//
// 시각적 순서는 PODIUM_SLOTS 대로 2위 · 1위 · 3위다(1위가 가운데).
const PODIUM_ARROW_LEFT: Record<1 | 2 | 3, string> = {
  2: '15.67%',
  1: '50%',
  3: '84.33%',
};

// 리더보드 줄을 눌렀을 때 아래로 펼쳐지는 패널. 클랜원 상세 페이지와 **같은
// 컴포넌트**를 압축 모드로 쓴다 — 두 화면이 다른 코드를 쓰면 한쪽만 고쳐진다.
//
// 집계 창은 리더보드 상단 토글을 그대로 따라가므로 패널 안에는 토글을 두지 않는다.
function MemberStandingPanel({
  member,
  activeWindow,
  recent16,
  alltime,
  sessions,
  standingByDate,
  arrowRank,
}: {
  member: RankingStatsRow;
  activeWindow: Window;
  recent16: RankingStatsRow[];
  alltime: RankingStatsRow[];
  sessions: RecentSession[];
  standingByDate: Map<string, number>;
  /**
   * 시상대(1~3위)에서 펼쳤을 때 그 등수. 주면 패널이 시상대 아래에 홀로 놓이고
   * 위쪽에 **뾰족한 꼭지**가 생겨 세 칸 중 누구를 눌렀는지 가리킨다 — 시상대는
   * 3열이라 칸 안에 패널을 넣을 수 없어서, 꼭지가 유일한 연결 표시다.
   * 없으면 4위 이하 표 줄에 그대로 붙는 모양이다.
   */
  arrowRank?: 1 | 2 | 3;
}) {
  const stats = useMemo(
    () => ({
      alltime: buildWindowStats(member.memberId, alltime),
      recent16: buildWindowStats(member.memberId, recent16),
    }),
    [member.memberId, alltime, recent16],
  );

  // 테두리는 그 사람 티어 색으로 은은하게 빛낸다 — 클랜원 상세 카드가 쓰는
  // 것과 같은 배합(from 66% 테두리 / from 33% 번짐)이라 두 화면이 같은 말을 한다.
  const ramp = tierColorRamp(member.tier);
  const glow = {
    borderColor: `${ramp.from}66`,
    boxShadow: `0 0 24px ${ramp.from}33`,
  };

  return (
    <div
      data-testid={`ranking-panel-${member.memberId}`}
      className={
        arrowRank
          ? 'relative mx-auto mt-5 max-w-4xl rounded-xl border bg-[#17171E] p-4'
          : 'relative mb-1 rounded-b-xl border border-t-0 bg-[#17171E] p-4'
      }
      style={glow}
    >
      {arrowRank && (
        // 정사각형을 45° 돌려 위 두 변만 테두리를 남긴 고전적인 말풍선 꼭지.
        // 패널과 같은 배경색이라 아래쪽 테두리 선이 꼭지 안에서 끊겨 보이지 않는다.
        // 한 변 20px 정사각형을 돌리면 대각선이 28px 이라, top -11px 에 두면
        // 위로 15px 쯤 튀어나오고 아래 절반은 패널 안에 잠겨 테두리를 지운다.
        // 👉 더/덜 튀어나오게 하려면 w/h 와 top 을 같이 키우면 된다(top ≈ -(변/2+1)).
        <span
          aria-hidden="true"
          data-testid="podium-panel-arrow"
          className="absolute -top-[11px] -ml-[10px] h-5 w-5 rotate-45 border-l border-t"
          style={{
            left: PODIUM_ARROW_LEFT[arrowRank],
            background: '#17171E',
            borderColor: `${ramp.from}66`,
          }}
        />
      )}
      <MemberDashboard
        stats={stats}
        sessions={sessions}
        standingByDate={standingByDate}
        ramp={tierColorRamp(member.tier)}
        compact
        window={activeWindow}
      />
      <div className="mt-2.5 text-right">
        <Link
          href={`/members/${member.memberId}`}
          className="text-xs text-menu transition-colors hover:text-foreground"
        >
          클랜원 상세 보기 →
        </Link>
      </div>
    </div>
  );
}

export interface TierRankingPodiumProps {
  recent16: RankingStatsRow[];
  alltime: RankingStatsRow[];
  snapshots: RankingSnapshotRow[];
  /**
   * 드롭다운에 쓸 최근 내전 회차와 그 등수. 없으면 줄은 여전히 펼쳐지되 칩 줄만
   * 안 나온다 — 등수를 아직 한 번도 확정하지 않은 상태에서도 표는 멀쩡해야 한다.
   */
  sessions?: RecentSession[];
  standings?: SessionStanding[];
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

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

// "평균 이상" 표시를 평균에서 이만큼(표준편차 단위) 못 미친 사람까지 넓혀서
// 보여준다 — 사용자가 실측 데이터(종합점수 기준 +13명/전체, +0~3명/작은 티어)를
// 보고 고른 값이다. 0.5 는 너무 많이 보여주고(+28명), 1은 사실상 다 보여준다(+53명).
const SHOW_BELOW_AVERAGE_SD = 0.25;

// topRanked 는 지표에 따라 score 가 있을 수도(rageScore) 없을 수도 있는 행이다 —
// 지표별로 "비교에 쓸 숫자 하나"를 뽑아내는 공용 접근자.
function metricValueOf(metric: Metric, row: RankingStatsRow & { score?: number }): number {
  if (metric === 'rageScore') return row.score ?? 0;
  if (metric === 'avgRank') return row.avgRank;
  return row.avgKills;
}

// "평균 이상" 구분선에 쓸 라벨 — 단위는 formatMetricValue 와 맞춘다(소수 자리수까지).
function formatAverageLabel(metric: Metric, value: number): string {
  if (metric === 'avgKills') return `평균 ${value.toFixed(2)}킬`;
  if (metric === 'avgRank') return `평균 ${value.toFixed(1)}등`;
  return `평균 ${value.toFixed(1)}점`;
}

// 정렬된 목록(topRanked, 좋은 순서대로) 안에서 "평균보다 나쁜" 첫 사람의 인덱스를 찾는다 —
// 그 인덱스 바로 앞에 구분선을 꽂으면 위쪽이 전부 평균 이상이 된다. 전원이 평균
// 이상이면 목록 길이(맨 끝)를 반환한다.
function findAverageInsertIndex(values: number[], average: number, higherIsBetter: boolean): number {
  for (let i = 0; i < values.length; i++) {
    const aboveAverage = higherIsBetter ? values[i] >= average : values[i] <= average;
    if (!aboveAverage) return i;
  }
  return values.length;
}

// 점수 박스 사이에 꽂는 점선 구분선 — "여기부터 평균 이하" 를 한눈에 보여준다.
function AverageDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1" aria-hidden="true">
      <span className="h-0 flex-1 border-t border-dashed border-white/25" />
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-white/50">{label}</span>
      <span className="h-0 flex-1 border-t border-dashed border-white/25" />
    </div>
  );
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

// 탭·필터 같은 UI 부속은 강조색을 쓰지 않는다. 예전엔 전부 주황이라 화면에
// 주황이 너무 많았고, 정작 봐야 할 D-DAY·트로피가 묻혔다. 여기는 흰색 계열로만
// 선택 상태를 표현하고(네비 활성 탭과 같은 방식), 주황은 아래 두 곳에만 남긴다.
function toggleButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white'
    : 'rounded-full bg-white/[0.03] px-4 py-2 text-sm text-menu transition-colors hover:bg-white/[0.06] hover:text-foreground';
}

// 원본 Frame 1(선택된 알약): 모서리 8.24 / 좌우 패딩 24.73 / 상하 8.24.
// 👉 선택된 탭 색 조절은 여기(bg-white/10, text-white).
function windowButtonClass(selected: boolean): string {
  return selected
    ? 'rounded-lg bg-white/10 px-6 py-2 text-sm font-bold text-white'
    : 'rounded-lg px-6 py-2 text-sm text-menu transition-colors hover:text-foreground';
}

export function TierRankingPodium({
  recent16,
  alltime,
  snapshots,
  sessions = [],
  standings = [],
}: TierRankingPodiumProps) {
  const { isAdmin } = useAdmin();
  const [activeMetric, setActiveMetric] = useState<Metric>('rageScore');
  const [activeWindow, setActiveWindow] = useState<Window>('recent16');
  const [activeGroupId, setActiveGroupId] = useState<TierGroup['id']>(TIER_GROUPS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  // 한 번에 한 명만 펼친다 — 여러 줄이 동시에 열리면 표가 어디까지가 누구 것인지
  // 알아보기 어려워진다.
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const standingByMember = useMemo(() => standingsByMember(standings), [standings]);

  // 변동 칸은 종합점수 탭에만 있다 — 표 전체(헤더+행)가 같은 판단을 써야 열이
  // 어긋나지 않으므로 여기 한 곳에서만 정한다.
  const showRankChange = activeMetric === 'rageScore';
  const rankingGrid = showRankChange ? RANKING_GRID : RANKING_GRID_NO_CHANGE;

  const snapshotRankByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const snapshot of snapshots) {
      if (snapshot.window !== activeWindow || snapshot.groupId !== activeGroupId) continue;
      // rankPosition 은 "이번 캡처 시점" 등수라 캡처 직후엔 항상 지금 계산하는
      // 등수와 같아져서 비교 기준이 못 된다 — previousRankPosition(그 앞 세션
      // 결과)과 비교해야 "이번 세션으로 얼마나 움직였는지"가 나온다(0031).
      //
      // previousRankPosition 이 null이면 두 가지 경우다: 그 사람이 정말 처음
      // 랭킹에 들었거나, 0031 이전에 이미 캡처된 행이라 지난 세션 값을 아예
      // 복구할 수 없는 경우. 후자가 훨씬 흔한데(도입 시점의 기존 행 전부가
      // 여기 해당한다) 그걸 전부 "신규"로 띄우면 명단 절반이 갑자기 NEW로
      // 도배된다 — 그래서 rankPosition(예전 방식, 지금과 같아 변동 없음으로
      // 보임)으로 조용히 물러난다. 다음 세션이 한 번 캡처되고 나면 이 분기 없이
      // 정상적으로 비교된다.
      const previous = snapshot.previousRankPosition ?? snapshot.rankPosition;
      map.set(snapshot.memberId, previous);
    }
    return map;
  }, [snapshots, activeWindow, activeGroupId]);

  // 서버/클라이언트 시각이 어긋나 하이드레이션 경고가 나지 않도록, 마운트 후에만 채운다.
  // 이후 1초마다 갱신해서 카운트다운의 초 단위가 실제로 흐르게 한다.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeGroup = TIER_GROUPS.find((group) => group.id === activeGroupId) ?? TIER_GROUPS[0];
  const rows = activeWindow === 'recent16' ? recent16 : alltime;
  const eligible = eligibleForRanking(rows);
  const groupRows =
    activeGroup.tiers === null
      ? eligible
      : eligible.filter((row) => activeGroup.tiers!.includes(row.tier));

  // 일반 사용자는 전체 탭 40명/티어별 탭 10명까지만 보여준다 — 관리자는 제한 없음.
  const baseRankingSize = isAdmin ? groupRows.length : activeGroup.tiers === null ? 40 : 10;

  // 평균은 항상 groupRows(자격자 전체) 기준으로 낸다 — 화면에 보이는 상위권만으로
  // 내면 실제 티어 평균보다 항상 높게 나온다. avgRank 는 숫자가 작을수록 좋아서
  // higherIsBetter 가 반대다.
  const higherIsBetter = activeMetric !== 'avgRank';
  const groupMetricValues =
    activeMetric === 'rageScore'
      ? rageScores(groupRows, TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS).map((r) => r.score)
      : activeMetric === 'avgRank'
        ? groupRows.map((r) => r.avgRank)
        : groupRows.map((r) => r.avgKills);
  const groupAverage = groupMetricValues.length === 0 ? null : mean(groupMetricValues);

  // 평균 위 전원 + 평균에서 살짝(-0.25 SD) 못 미친 사람까지 보여준다 — 인원이
  // 많은 그룹일수록 평균 근처에 사람이 몰려있어, 딱 평균에서 끊으면 거의 다 된
  // 사람이 안 보이는 게 어색해서다. 종합점수는 이미 밴드 안에서 z-score(SD=1)로
  // 정규화돼 있어 -0.25 SD 지점의 점수가 스티프니스로 바로 계산된다(경기 데이터를
  // 다시 볼 필요가 없다). 평균등수·평균킬은 원본 값 분포라 그룹 표준편차를 직접
  // 구해서 뺀다/더한다.
  const groupThreshold =
    groupAverage === null
      ? null
      : activeMetric === 'rageScore'
        ? 100 / (1 + Math.exp(RAGE_SCORE_STEEPNESS * SHOW_BELOW_AVERAGE_SD))
        : groupAverage +
          (higherIsBetter ? -1 : 1) * SHOW_BELOW_AVERAGE_SD * stddev(groupMetricValues, groupAverage);
  const countToShow =
    groupThreshold === null
      ? 0
      : groupMetricValues.filter((v) => (higherIsBetter ? v >= groupThreshold : v <= groupThreshold)).length;

  // 원래 인원 제한(10/40명)보다 컷오프 이상인 사람이 더 많으면, 그 사람들이 전부
  // 보이도록 목록을 늘린다 — 0~1.5티어처럼 대상이 7명뿐이면 원래 제한(10명)
  // 그대로, 대상이 40명을 넘는 큰 그룹이면 그만큼 더 보여준다.
  const RANKING_SIZE = Math.max(baseRankingSize, countToShow);
  const topRanked =
    activeMetric === 'rageScore'
      ? topByRageScore(groupRows, TIER_SCORE_BANDS, RAGE_SCORE_STEEPNESS, RANKING_SIZE)
      : activeMetric === 'avgRank'
        ? topByAvgRank(groupRows, RANKING_SIZE)
        : topByAvgKills(groupRows, RANKING_SIZE);
  const top = topRanked.slice(0, 3);
  const restRanked = topRanked.slice(3, RANKING_SIZE);

  const averageInsertIndex =
    groupAverage === null
      ? null
      : findAverageInsertIndex(
          topRanked.map((r) => metricValueOf(activeMetric, r)),
          groupAverage,
          higherIsBetter,
        );

  return (
    <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
      {/* 뱃지 열 트로피가 쓰는 그라디언트. 줄마다 정의하면 같은 id 가 수십 번
          겹치므로 문서에 하나만 두고 모든 줄이 이걸 가리킨다. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <TrophyGoldGradient id={RANKING_TROPHY_GOLD} />
        </defs>
      </svg>

      {/* 제목이 위, 집계 창 토글(역대 전체/최근 12매치)이 그 아래 — 사용자가 지정한 순서. */}
      <div className="flex flex-col items-center text-center">
        <p className="hud text-[11px] text-accent sm:text-xs">
          {siteConfig.dashboard.tierRanking.eyebrow}
        </p>
        <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
          {siteConfig.dashboard.tierRanking.heading}
        </h2>
      </div>

      <div className="mt-8 flex justify-center">
        {/* relative 래퍼 — 물음표 아이콘을 absolute 로 띄워야 토글이 화면 정중앙을
            유지한다. flex 안에 나란히 넣으면 아이콘 폭만큼 토글이 왼쪽으로 밀린다. */}
        <div className="relative">
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

          {/* 설명 말풍선 — 마우스를 올리면 뜨고 떼면 사라진다. 상태 없이 CSS 만 쓴다. */}
          <span className="group absolute left-full top-1/2 ml-3 -translate-y-1/2">
            {/* button 이 아니라 span 이다: button 이면 클릭 시 포커스가 남아 말풍선이
                붙박이로 떠 있게 된다. 클릭 자체가 필요 없는 안내라서 비대화형으로 두고,
                cursor-default 로 "누르는 것 아님"을 커서로도 알린다.
                aria-hidden 은 '?' 글자에만 건다 — 설명 문구는 아래에 그대로 남아
                스크린리더가 읽을 수 있다. */}
            <span
              aria-hidden="true"
              className="flex h-5 w-5 cursor-default select-none items-center justify-center rounded-full border border-white/25 text-[11px] font-bold leading-none text-white/50 transition-colors group-hover:border-white/60 group-hover:text-white"
            >
              ?
            </span>

            {/* 1시 방향(위-오른쪽)으로 펼친다. 아래로 펼치면 지표·티어 탭을 가려서
                정작 조작할 버튼이 안 보였다. */}
            <span
              className="pointer-events-none absolute bottom-full left-full z-20 mb-2 ml-2 w-max max-w-[15rem] space-y-1.5 rounded-lg border border-white/10 px-3 py-2 text-left text-xs leading-relaxed text-menu opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
              style={{ background: RANKING_ROW_BG }}
            >
              {WINDOW_HELP.map((item) => (
                <span key={item.term} className="block">
                  <b className="font-bold text-foreground">{item.term}</b>
                  <span className="text-menu"> · {item.desc}</span>
                </span>
              ))}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {METRIC_OPTIONS.map((option) => (
          <Fragment key={option.id}>
            {/* "종합점수"는 사람들이 제일 헷갈려해서 물음표 설명을 왼쪽에 둔다 —
                집계 창 물음표와 같은 hover 말풍선 패턴. 말풍선은 아래로 펼치면
                바로 밑의 티어 탭 줄을 가려서, 이번엔 물음표 기준 왼쪽 위로 띄운다. */}
            {option.id === 'rageScore' && (
              <span className="group relative">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 cursor-default select-none items-center justify-center rounded-full border border-white/25 text-[11px] font-bold leading-none text-white/50 transition-colors group-hover:border-white/60 group-hover:text-white"
                >
                  ?
                </span>
                <span
                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 flex w-max max-w-[28rem] flex-col gap-1 rounded-lg border border-white/10 px-3 py-2 text-left text-xs leading-relaxed text-menu opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  style={{ background: RANKING_ROW_BG }}
                >
                  {RAGE_SCORE_HELP.map((line, i) => (
                    <span key={line} className="whitespace-nowrap">
                      {i + 1}. {line}
                    </span>
                  ))}
                </span>
              </span>
            )}
            <button
              type="button"
              aria-pressed={option.id === activeMetric}
              onClick={() => setActiveMetric(option.id)}
              className={toggleButtonClass(option.id === activeMetric)}
            >
              {option.label}
            </button>
            {/* 종합점수(관계형 상대점수)와 평균등수/평균킬(그냥 평균) 사이만
                구분선을 둔다 — 성격이 다른 지표라는 걸 시각적으로 나눈다. */}
            {option.id === 'rageScore' && (
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
            )}
          </Fragment>
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
          const expanded = member !== undefined && expandedMemberId === member.memberId;
          const toggle = () => {
            if (!member) return;
            setExpandedMemberId(expanded ? null : member.memberId);
          };
          return (
            <div
              key={slot.rank}
              data-testid={`podium-slot-${slot.rank}`}
              // 시상대 칸도 4위 이하 표 줄과 똑같이 눌러서 펼친다. 펼쳐진 패널은
              // 이 칸 안이 아니라 시상대 세 칸 전체 아래에 놓인다(폭 때문에).
              {...(member
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    'aria-expanded': expanded,
                    onClick: toggle,
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggle();
                      }
                    },
                  }
                : {})}
              className={`${slot.order} ${slot.offset} flex min-w-0 flex-1 basis-0 flex-col items-center rounded-xl outline-none ring-white/20 focus-visible:ring-2 ${
                member ? 'cursor-pointer' : ''
              }`}
            >
              {/* 아바타 — 실사진이 없어서 넣는 더미 이미지. */}
              <DummyAvatar />

              {/* 이름 */}
              <p className="mt-3 max-w-full truncate text-xl font-bold text-foreground sm:text-2xl">
                {member ? member.discordNickname : '—'}
              </p>

              {/* 펼침 표시 — 이름과 시상대 사이의 빈 자리(mt-8)에 넣어 가운데 정렬된
                  이름을 밀지 않는다. */}
              {member && (
                <span
                  aria-hidden="true"
                  className={`mt-1 text-[10px] leading-none text-menu transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              )}

              {/* 시상대 3D 박스 — 윗면(사다리꼴)과 앞면(그라데이션, 아래로 갈수록
                  어두워지다 배경에 마스크로 녹아 사라짐) 두 겹으로 입체감을 준다. */}
              <div className="relative mt-8 w-full">
                {/* 윗면 — 가까운(아래) 변이 넓고 먼(위) 변이 좁은 사다리꼴, 책상 상판을
                    비스듬히 내려다본 모양이다. */}
                <div
                  aria-hidden="true"
                  className="h-8 w-full sm:h-10"
                  style={{
                    clipPath: 'polygon(0% 100%, 100% 100%, 84% 0%, 16% 0%)',
                    background: PEDESTAL_TOP_COLOR,
                  }}
                />

                {/* 트로피 사각 배지 — 윗면과 앞면이 만나는 경계선에 절반씩 걸치게. */}
                <span className="absolute left-1/2 top-8 z-10 -translate-x-1/2 -translate-y-1/2 sm:top-10">
                  {member ? (
                    <TrophySquare rank={slot.rank} />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-lg font-bold text-white/25 sm:h-11 sm:w-11">
                      {slot.rank}
                    </span>
                  )}
                </span>

                {/* 앞면 + 콘텐츠 — 참고 이미지처럼 짧고 납작하게. 높이를 줄인 만큼
                    마스크 페이드도 뒤로 밀어(60%) 점수가 흐려지지 않게 한다. */}
                <div className="relative -mt-px h-[190px] w-full sm:h-[220px]">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 border border-t-0 border-white/[0.08]"
                    style={{
                      background: PEDESTAL_GRADIENT,
                      maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                    }}
                  />

                  <div className="relative flex h-full w-full flex-col items-center px-2 pt-8 sm:px-4 sm:pt-10">
                    {member && (
                      <>
                        <TierBadge tier={member.tier} />

                        {/* 원본 Vector 2 — 시상대 안쪽 가로 구분선(흰색 7%) */}
                        <span aria-hidden="true" className="mt-4 h-px w-[89%] bg-white/[0.07]" />

                        {/* 점수는 시상대 정중앙에 두고 증감만 그 오른쪽에 붙인다.
                            증감을 같은 흐름에 넣으면 둘의 폭을 합친 가운데가
                            중앙이 되어 점수가 왼쪽으로 밀린다 — 그래서 증감만
                            absolute 로 띄워 점수 폭에 영향을 주지 않게 한다.
                            모바일은 시상대 한 칸이 115px 뿐이라 오른쪽에 붙이면
                            카드 밖으로 나간다. 거기서는 점수 아래에 둔다. */}
                        <p className="relative mt-5 tabular-nums">
                          <MetricValue
                            metric={activeMetric}
                            row={member}
                            className="text-2xl font-bold text-foreground sm:text-3xl"
                            detailClassName="text-sm font-normal text-menu"
                            stacked
                          />
                          {activeMetric === 'rageScore' && (
                            <RankChangeBadge
                              current={slot.rank}
                              previous={snapshotRankByMember.get(member.memberId)}
                              className="mt-1 block whitespace-nowrap sm:absolute sm:left-full sm:top-5 sm:ml-2 sm:mt-0 sm:-translate-y-1/2"
                            />
                          )}
                        </p>

                        {/* 뱃지 칸 — 앞으로 뱃지가 늘어날 자리다. 지금은 종합우승
                            트로피 하나뿐이라 비어 보일 수 있지만, 자리를 미리
                            잡아둬야 뱃지가 붙을 때 시상대 높이가 안 흔들린다. */}
                        <div className="mt-3 flex min-h-[1.25rem] items-center justify-center gap-1.5">
                          <WinBadge
                            count={member.winCount}
                            className="text-[13px] sm:text-sm"
                            gradientId={RANKING_TROPHY_GOLD}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 시상대에서 펼친 사람의 패널. 시상대는 3열이라 칸 안에 넣으면 폭이 1/3
          밖에 안 나온다 — 세 칸 전체 아래에 전폭으로 편다. */}
      {(() => {
        const podiumIndex = top.findIndex((row) => row.memberId === expandedMemberId);
        if (podiumIndex === -1) return null;
        const podiumMember = top[podiumIndex];
        return (
          <MemberStandingPanel
            member={podiumMember}
            activeWindow={activeWindow}
            recent16={recent16}
            alltime={alltime}
            sessions={sessions}
            standingByDate={standingByMember.get(podiumMember.memberId) ?? EMPTY_STANDINGS}
            arrowRank={(podiumIndex + 1) as 1 | 2 | 3}
          />
        );
      })()}

      {/* 다음 내전까지 카운트다운 — 참고 이미지의 "Ends in" 블록 구조 그대로
          시계 아이콘 / 라벨 / 남은 시간 세 덩어리를 세로로 쌓는다.
          내전 일정은 매주 목·일 19:30 KST (lib/nextScrim.ts).
          `now` 는 1초마다 갱신되므로 초 단위가 실제로 흐른다. */}
      {now && (
        <div className="mx-auto mt-10 flex w-fit max-w-full flex-col items-center gap-3 text-center">
          <ClockIcon />
          <p className="text-sm text-menu">다음 내전까지</p>
          <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {formatCountdown(nextScrimDate(now), now)}
          </p>
        </div>
      )}

      {/* 카운트다운과 4위 이하 표 사이의 구분선. 양끝이 서서히 사라지는 그라데이션이라
          가운데 밝기(아래 0.4)가 곧 선의 체감 밝기다 — 0.14 는 배경에 묻혀 안 보였다.
          👉 밝기 조절은 rgba 의 마지막 값. */}
      <div
        aria-hidden="true"
        className="mx-auto mt-12 h-px w-[43%]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        }}
      />

      {restRanked.length > 0 && (
        <div className="mx-auto mt-8 max-w-4xl">
          {isAdmin && (
            // px-4 를 주지 않는다 — 검색창도 등수 카드와 같은 "박스"라서, 카드
            // 안쪽 글자(px-4 만큼 들어와 있다)가 아니라 **카드 바깥 테두리**와
            // 오른쪽 끝을 맞춰야 세로로 일자가 된다.
            // mb-6 은 위 구분선과 아래 등수 카드들 "사이"에 떠 있는 자기 영역처럼
            // 보이게 하는 여백이다(전엔 mb-2라 헤더 줄에 거의 붙어 보였다).
            <div className="mb-6 flex justify-end">
              <div className="relative w-40">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="닉네임 검색"
                  className="w-full rounded-md border border-white/15 bg-white/[0.03] py-1.5 pl-7 pr-3 text-right text-sm text-foreground placeholder:text-menu focus:border-accent focus:outline-none"
                />
                {/* 돋보기 아이콘 — 클릭 동작은 없다(입력창이 이미 자동으로 필터링한다),
                    검색창이라는 걸 한눈에 알아보게 하는 표시일 뿐. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-menu"
                >
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M16 16L13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}

          {/* 목차(헤더)와 그 아래 실제 데이터 모두 왼쪽 정렬로 통일한다 — 칸마다
              정렬 방식이 다르면(가운데/오른쪽 섞임) 위아래로 훑을 때 눈이
              흔들린다. */}
          <div className={`${rankingGrid} px-4 pb-2 text-xs text-white/60`}>
            <span>등수</span>
            <span>닉네임</span>
            <span>티어</span>
            <span>뱃지</span>
            {/* 변동 칸이 있을 때만 라벨 뒤에 공백 한 칸을 붙여 오른쪽 끝에서 살짝 띄운다.
                변동이 없는 지표는 박스 끝까지 다 써야 하므로 공백을 안 붙인다. */}
            <span className="text-right">
              {METRIC_OPTIONS.find((o) => o.id === activeMetric)?.label}
              {showRankChange ? HEADER_TRAILING_SPACE : ''}
            </span>
            {showRankChange && <span className="text-center">변동</span>}
          </div>

          {(() => {
            const query = searchQuery.trim().toLowerCase();
            const displayedRanked =
              isAdmin && query
                ? restRanked.filter((member) => member.discordNickname.toLowerCase().includes(query))
                : restRanked;

            if (displayedRanked.length === 0) {
              return <p className="mt-4 text-center text-sm text-menu">검색 결과가 없습니다</p>;
            }

            // 검색 중엔 목록이 필터링돼 원래 자리와 무관해지므로 구분선을 안 보여준다.
            const showAverageDivider = !query && averageInsertIndex !== null && groupAverage !== null;
            const averageLabel = groupAverage !== null ? formatAverageLabel(activeMetric, groupAverage) : '';
            // averageInsertIndex 는 top(3) 다음부터 시작하는 restRanked 기준 인덱스로 옮겨 쓴다.
            // 3 이하(=1~3위조차 평균 이하)면 표 맨 위에, restRanked.length 를 넘기면
            // (=보이는 사람 전원이 평균 이상) 표 맨 아래에 꽂는다.
            const dividerIndexInRest =
              averageInsertIndex === null ? null : Math.max(0, averageInsertIndex - 3);

            return (
              /* 줄마다 배경이 깔린 알약 모양이고, 구분선은 쓰지 않는다. */
              <div className="space-y-1">
                {showAverageDivider && dividerIndexInRest === 0 && <AverageDivider label={averageLabel} />}
                {displayedRanked.map((member) => {
                  const originalRank = restRanked.indexOf(member) + 4;
                  const indexInRest = originalRank - 4;
                  const expanded = expandedMemberId === member.memberId;
                  return (
                    <Fragment key={member.memberId}>
                      <div
                        data-testid={`ranking-row-${originalRank}`}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedMemberId(expanded ? null : member.memberId)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedMemberId(expanded ? null : member.memberId);
                          }
                        }}
                        className={`${rankingGrid} cursor-pointer rounded-xl px-4 py-2.5 outline-none ring-white/20 focus-visible:ring-2 ${
                          expanded ? 'rounded-b-none' : ''
                        }`}
                        style={{ background: RANKING_ROW_BG }}
                      >
                        <span className="text-sm font-bold text-menu">{originalRank}</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground">
                          <span
                            aria-hidden="true"
                            className={`shrink-0 text-[9px] text-menu transition-transform ${expanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                          <span className="truncate">{member.discordNickname}</span>
                        </span>
                        <TierBadge tier={member.tier} className="justify-self-start" />
                        {/* 뱃지 줄 — 왼쪽부터 하나씩 채운다. 뱃지가 늘어도 앞의
                            것들 자리는 그대로다. */}
                        <span className="flex min-w-0 items-center gap-1.5">
                          <WinBadge
                            count={member.winCount}
                            className="text-[13px] sm:text-[15px]"
                            none={<span className="text-sm text-menu">-</span>}
                            gradientId={RANKING_TROPHY_GOLD}
                          />
                        </span>
                        <span className="text-right tabular-nums">
                          <MetricValue
                            metric={activeMetric}
                            row={member}
                            className="text-sm font-bold text-foreground"
                            detailClassName="text-xs font-normal text-menu"
                          />
                        </span>
                        {showRankChange && (
                          // 좌우는 칸 중앙, 상하는 등수 박스(행) 자체의 세로 중앙선에
                          // 맞춘다 — 점수와 나란히 한 줄로 읽히게.
                          <span className="flex items-center justify-center self-center">
                            <RankChangeBadge
                              current={originalRank}
                              previous={snapshotRankByMember.get(member.memberId)}
                            />
                          </span>
                        )}
                      </div>
                      {expanded && (
                        <MemberStandingPanel
                          member={member}
                          activeWindow={activeWindow}
                          recent16={recent16}
                          alltime={alltime}
                          sessions={sessions}
                          standingByDate={standingByMember.get(member.memberId) ?? EMPTY_STANDINGS}
                        />
                      )}
                      {showAverageDivider && dividerIndexInRest === indexInRest + 1 && (
                        <AverageDivider label={averageLabel} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            );
          })()}

          <p className="mt-3 text-right text-xs text-menu">
            총 {groupRows.length}명 중 {topRanked.length}명
          </p>
        </div>
      )}

      {/* 보조 정보라 강조색을 뺐다 — 흰색 계열로만 구분한다. */}
      <div className="mx-auto mt-16 max-w-4xl border-l-2 border-white/15 bg-white/[0.03] px-5 py-4">
        <p className="hud text-[11px] font-bold text-white/70">집계 기준</p>
        <ul className="mt-3 space-y-1.5 text-xs text-menu">
          {AGGREGATION_RULES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden="true" className="text-white/40">
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
