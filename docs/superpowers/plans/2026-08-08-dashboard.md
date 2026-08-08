# 대시보드 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard` 페이지를 만든다 — 상단에는 티어 그룹별 종합점수 Top3 포디움 랭킹, 하단에는 최근 내전 10개 목록(다시보기 링크 포함)을 보여준다. 데이터는 실제 구조와 동일한 목업이다.

**Architecture:** 목업 데이터와 순수 계산 로직(`lib/dashboardData.ts`)을 UI 컴포넌트(`components/dashboard/`)에서 분리한다. 랭킹 포디움은 탭 상태가 있는 클라이언트 컴포넌트, 내전 목록은 정적 서버 컴포넌트다. 기존 랜딩페이지의 `Nav`/`Footer`를 그대로 재사용하되, `siteConfig`에 이미 있던 `ready` 플래그를 실제로 반영해 `DASHBOARD`/`대시보드` 링크만 활성화한다.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Vitest + @testing-library/react (이 저장소 최초의 테스트 인프라 — Task 1에서 구성)

## Global Constraints

- 라우트: `/dashboard`, 로그인 없이 공개.
- 티어 그룹 5개, 이 순서 고정: `전체`(모든 티어) · `0~1.5티어`(0, 1, 1.5) · `2~2.5티어`(2, 2.5) · `3~3.5티어`(3, 3.5) · `4~4.5티어`(4, 4.5).
- 랭킹은 종합 점수(`score`) 내림차순 Top3, 시상대(포디움) 형태.
- `전체` 탭에서만 각 카드에 티어 배지를 보여준다. 티어 그룹 탭에서는 생략한다.
- Top3가 다 안 채워지면 빈 자리를 "—"로 표시한다 (숨기지 않는다).
- 최근 내전 목록은 10개, 최신순.
- 각 행: 내전 이름(`2026 RAGE 클랜내전 #N` 형식) · 날짜/요일 · 참여 인원수 · 경기 수 · 다시보기(URL 있으면 링크 버튼, 없으면 "다시보기 준비중" 비활성 표시).
- 참여 인원수/경기 수는 보통 64명·4경기이지만 각 행의 실제 값을 그대로 표시한다(고정 텍스트 금지).
- `siteConfig.nav`의 `DASHBOARD`, `siteConfig.footer.links`의 `대시보드`만 `ready: true`로 바꾼다. 나머지 항목은 계속 비활성.
- 컴포넌트는 계산 로직을 갖지 않는다 — 목업 데이터와 순수 함수는 전부 `lib/dashboardData.ts`에 둔다.
- 색상 토큰(`background` `#0E0B13`, `accent` `#FF9233`, `accent-secondary` `#C49520`, `foreground` `#FFFFFF`, `muted` `#322F36`, `menu` `#A0A0A2`, `positive` `#4ADE80`)과 `max-w-shell`(1200px)은 `tailwind.config.ts`에 이미 정의돼 있다. 새로 만들지 않는다.
- Vitest 테스트 파일에서 한 파일 안에 `render()`를 2번 이상 호출하면 파일 스코프 `afterEach(cleanup)`을 반드시 넣는다 (jsdom은 파일 간에는 격리되지만 파일 안에서는 정리되지 않는다).

---

### Task 1: 목업 데이터 & 순수 로직 (`lib/dashboardData.ts`) + 테스트 인프라 구성

**Files:**
- Create: `lib/dashboardData.ts`
- Create: `lib/dashboardData.test.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (테스트 스크립트 + devDependencies 추가)

**Interfaces:**
- Produces:
  - `interface Member { id: string; ign: string; tier: number; score: number }`
  - `interface ScrimSession { id: string; title: string; date: string; participantCount: number; matchCount: number; replayUrl: string | null }`
  - `interface TierGroup { id: string; label: string; tiers: number[] | null }`
  - `const TIER_GROUPS: TierGroup[]` — 5개, 순서: `all`/`전체`, `0-1.5`/`0~1.5티어`, `2-2.5`/`2~2.5티어`, `3-3.5`/`3~3.5티어`, `4-4.5`/`4~4.5티어`
  - `const MEMBERS: Member[]` — 17명, `4-4.5` 그룹에 정확히 1명만 존재 (포디움 빈자리 케이스 검증용)
  - `const SCRIM_SESSIONS: ScrimSession[]` — 10개, 최신순
  - `function getTopMembers(members: Member[], group: TierGroup, limit?: number): Member[]`
  - `function formatScrimDate(dateISO: string): string`

Task 2(포디움), Task 3(내전 목록), Task 4(Nav/Footer 테스트에서 참조는 안 함)가 이 모듈을 가져다 쓴다.

- [ ] **Step 1: 테스트 관련 의존성 설치**

Run: `npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`

- [ ] **Step 2: package.json에 test 스크립트 추가**

`package.json`의 `"scripts"` 블록을 다음으로 바꾼다 (기존 `dev`/`build`/`start`는 유지하고 `test`만 추가):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Vitest 설정 파일 작성**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

(`/vitest` 서브패스를 쓰면 `globals: true` 없이도 jest-dom 매처가 등록된다 — `vitest.config.ts`에 `globals`는 넣지 않는다.)

- [ ] **Step 4: 실패하는 테스트 작성**

`lib/dashboardData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  TIER_GROUPS,
  MEMBERS,
  SCRIM_SESSIONS,
  getTopMembers,
  formatScrimDate,
  type Member,
} from './dashboardData';

describe('TIER_GROUPS', () => {
  it('defines the five tier group tabs in order', () => {
    expect(TIER_GROUPS.map((g) => g.id)).toEqual(['all', '0-1.5', '2-2.5', '3-3.5', '4-4.5']);
    expect(TIER_GROUPS.map((g) => g.label)).toEqual([
      '전체',
      '0~1.5티어',
      '2~2.5티어',
      '3~3.5티어',
      '4~4.5티어',
    ]);
    expect(TIER_GROUPS[0].tiers).toBeNull();
    expect(TIER_GROUPS[1].tiers).toEqual([0, 1, 1.5]);
    expect(TIER_GROUPS[2].tiers).toEqual([2, 2.5]);
    expect(TIER_GROUPS[3].tiers).toEqual([3, 3.5]);
    expect(TIER_GROUPS[4].tiers).toEqual([4, 4.5]);
  });
});

describe('getTopMembers', () => {
  const fixture: Member[] = [
    { id: 'a', ign: 'Alpha', tier: 2, score: 50 },
    { id: 'b', ign: 'Bravo', tier: 2.5, score: 80 },
    { id: 'c', ign: 'Charlie', tier: 1, score: 90 },
    { id: 'd', ign: 'Delta', tier: 2, score: 70 },
  ];

  it('filters by the group tiers and sorts by score descending', () => {
    const group = { id: 'test', label: 'Test', tiers: [2, 2.5] };
    const top = getTopMembers(fixture, group);
    expect(top.map((m) => m.ign)).toEqual(['Bravo', 'Delta', 'Alpha']);
  });

  it('ignores the tier filter when tiers is null (전체)', () => {
    const group = { id: 'all', label: '전체', tiers: null };
    const top = getTopMembers(fixture, group);
    expect(top.map((m) => m.ign)).toEqual(['Charlie', 'Bravo', 'Delta']);
  });

  it('returns fewer than the limit when the group has too few members', () => {
    const group = { id: 'empty', label: 'Empty', tiers: [9] };
    const top = getTopMembers(fixture, group);
    expect(top).toHaveLength(0);
  });
});

describe('formatScrimDate', () => {
  it('labels a known Sunday correctly', () => {
    expect(formatScrimDate('2026-08-02')).toBe('2026-08-02 (일)');
  });

  it('labels a known Monday correctly', () => {
    expect(formatScrimDate('2026-08-03')).toBe('2026-08-03 (월)');
  });

  it('labels a known Saturday correctly', () => {
    expect(formatScrimDate('2026-08-08')).toBe('2026-08-08 (토)');
  });
});

describe('mock data', () => {
  it('leaves the 4~4.5 tier group with only one member, to exercise the empty-podium-slot case', () => {
    const group = TIER_GROUPS.find((g) => g.id === '4-4.5')!;
    const top = getTopMembers(MEMBERS, group);
    expect(top).toHaveLength(1);
    expect(top[0].ign).toBe('레이지에이스');
  });

  it('ships ten scrim sessions, most recent first', () => {
    expect(SCRIM_SESSIONS).toHaveLength(10);
    expect(SCRIM_SESSIONS[0].date).toBe('2026-08-02');
    expect(SCRIM_SESSIONS[9].date).toBe('2026-05-31');
  });
});
```

- [ ] **Step 5: 테스트 실행 → 실패 확인**

Run: `npm test -- lib/dashboardData.test.ts`
Expected: FAIL (`Cannot find module './dashboardData'`)

- [ ] **Step 6: 구현 작성**

`lib/dashboardData.ts`:
```ts
export interface Member {
  id: string;
  ign: string;
  tier: number;
  score: number;
}

export interface ScrimSession {
  id: string;
  title: string;
  date: string;
  participantCount: number;
  matchCount: number;
  replayUrl: string | null;
}

export interface TierGroup {
  id: string;
  label: string;
  tiers: number[] | null;
}

export const TIER_GROUPS: TierGroup[] = [
  { id: 'all', label: '전체', tiers: null },
  { id: '0-1.5', label: '0~1.5티어', tiers: [0, 1, 1.5] },
  { id: '2-2.5', label: '2~2.5티어', tiers: [2, 2.5] },
  { id: '3-3.5', label: '3~3.5티어', tiers: [3, 3.5] },
  { id: '4-4.5', label: '4~4.5티어', tiers: [4, 4.5] },
];

export function getTopMembers(members: Member[], group: TierGroup, limit = 3): Member[] {
  const filtered =
    group.tiers === null
      ? members
      : members.filter((member) => group.tiers!.includes(member.tier));
  return [...filtered].sort((a, b) => b.score - a.score).slice(0, limit);
}

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatScrimDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return `${dateISO} (${KOREAN_WEEKDAYS[utcDate.getUTCDay()]})`;
}

export const MEMBERS: Member[] = [
  { id: 'm01', ign: '아지트지킴이', tier: 0, score: 62.4 },
  { id: 'm02', ign: '초보헌터', tier: 1, score: 58.1 },
  { id: 'm03', ign: '느긋한스나', tier: 1.5, score: 71.3 },
  { id: 'm04', ign: '풀숲매복', tier: 0, score: 49.7 },
  { id: 'm05', ign: '연습생라이언', tier: 1, score: 65.0 },
  { id: 'm06', ign: '침착한저격수', tier: 2, score: 88.2 },
  { id: 'm07', ign: '질주하는탱커', tier: 2.5, score: 92.6 },
  { id: 'm08', ign: '한타장인', tier: 2, score: 79.4 },
  { id: 'm09', ign: '벽뚫는딜러', tier: 2.5, score: 85.1 },
  { id: 'm10', ign: '고요한추격자', tier: 2, score: 74.8 },
  { id: 'm11', ign: '번개같은컨트롤', tier: 2.5, score: 90.0 },
  { id: 'm12', ign: '냉철한지휘관', tier: 3, score: 101.5 },
  { id: 'm13', ign: '섬광탄장인', tier: 3.5, score: 108.2 },
  { id: 'm14', ign: '전선붕괴자', tier: 3, score: 96.7 },
  { id: 'm15', ign: '유령저격', tier: 3.5, score: 103.9 },
  { id: 'm16', ign: '완벽한로테이션', tier: 3, score: 99.1 },
  { id: 'm17', ign: '레이지에이스', tier: 4.5, score: 128.4 },
];

export const SCRIM_SESSIONS: ScrimSession[] = [
  {
    id: 'scrim-18',
    title: '2026 RAGE 클랜내전 #18',
    date: '2026-08-02',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-18',
  },
  {
    id: 'scrim-17',
    title: '2026 RAGE 클랜내전 #17',
    date: '2026-07-26',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-17',
  },
  {
    id: 'scrim-16',
    title: '2026 RAGE 클랜내전 #16',
    date: '2026-07-19',
    participantCount: 60,
    matchCount: 4,
    replayUrl: null,
  },
  {
    id: 'scrim-15',
    title: '2026 RAGE 클랜내전 #15',
    date: '2026-07-12',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-15',
  },
  {
    id: 'scrim-14',
    title: '2026 RAGE 클랜내전 #14',
    date: '2026-07-05',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-14',
  },
  {
    id: 'scrim-13',
    title: '2026 RAGE 클랜내전 #13',
    date: '2026-06-28',
    participantCount: 64,
    matchCount: 3,
    replayUrl: null,
  },
  {
    id: 'scrim-12',
    title: '2026 RAGE 클랜내전 #12',
    date: '2026-06-21',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-12',
  },
  {
    id: 'scrim-11',
    title: '2026 RAGE 클랜내전 #11',
    date: '2026-06-14',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-11',
  },
  {
    id: 'scrim-10',
    title: '2026 RAGE 클랜내전 #10',
    date: '2026-06-07',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-10',
  },
  {
    id: 'scrim-9',
    title: '2026 RAGE 클랜내전 #9',
    date: '2026-05-31',
    participantCount: 64,
    matchCount: 4,
    replayUrl: 'https://youtu.be/rage-scrim-9',
  },
];
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `npm test -- lib/dashboardData.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 8: 커밋**

```bash
git add package.json vitest.config.ts vitest.setup.ts lib/dashboardData.ts lib/dashboardData.test.ts
git commit -m "test: add vitest infra and dashboard mock data/logic"
```

---

### Task 2: 티어 랭킹 포디움 (`components/dashboard/TierRankingPodium.tsx`)

**Files:**
- Create: `components/dashboard/TierRankingPodium.tsx`
- Test: `components/dashboard/TierRankingPodium.test.tsx`

**Interfaces:**
- Consumes: `TIER_GROUPS`, `MEMBERS`, `getTopMembers`, `type TierGroup` (Task 1의 `@/lib/dashboardData`)
- Produces: `export function TierRankingPodium(): JSX.Element` — props 없음. 각 포디움 슬롯은 `data-testid="podium-slot-1"` / `"podium-slot-2"` / `"podium-slot-3"`. 각 탭 버튼은 `role="tab"`, 접근 가능한 이름은 `group.label`.

Task 5(페이지 조합)가 이 컴포넌트를 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/dashboard/TierRankingPodium.test.tsx`:
```tsx
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { TierRankingPodium } from './TierRankingPodium';

afterEach(cleanup);

describe('TierRankingPodium', () => {
  it('shows the overall top three with tier badges by default', () => {
    render(<TierRankingPodium />);
    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('레이지에이스')).toBeInTheDocument();
    expect(within(slot1).getByText('4.5티어')).toBeInTheDocument();
    expect(within(slot2).getByText('섬광탄장인')).toBeInTheDocument();
    expect(within(slot3).getByText('유령저격')).toBeInTheDocument();
  });

  it('switches to a tier group tab, hides tier badges, and shows empty slots when the group has fewer than three members', () => {
    render(<TierRankingPodium />);
    fireEvent.click(screen.getByRole('tab', { name: '4~4.5티어' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('레이지에이스')).toBeInTheDocument();
    expect(within(slot1).queryByText('4.5티어')).not.toBeInTheDocument();
    expect(within(slot2).getByText('—')).toBeInTheDocument();
    expect(within(slot3).getByText('—')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: '4~4.5티어' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- components/dashboard/TierRankingPodium.test.tsx`
Expected: FAIL (`Cannot find module './TierRankingPodium'`)

- [ ] **Step 3: 구현 작성**

`components/dashboard/TierRankingPodium.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { MEMBERS, TIER_GROUPS, getTopMembers, type TierGroup } from '@/lib/dashboardData';

const PODIUM_SLOTS: Array<{ rank: 1 | 2 | 3; order: string; height: string }> = [
  { rank: 2, order: 'order-1', height: 'h-40' },
  { rank: 1, order: 'order-2', height: 'h-52' },
  { rank: 3, order: 'order-3', height: 'h-32' },
];

export function TierRankingPodium() {
  const [activeGroupId, setActiveGroupId] = useState<TierGroup['id']>(TIER_GROUPS[0].id);
  const activeGroup = TIER_GROUPS.find((group) => group.id === activeGroupId) ?? TIER_GROUPS[0];
  const top = getTopMembers(MEMBERS, activeGroup);

  return (
    <section className="mx-auto max-w-shell px-5 py-16 sm:px-8">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">TIER RANKING</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">티어 랭킹</h2>

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
              <p className="text-xl font-bold text-accent">{slot.rank}</p>
              {member ? (
                <>
                  <p className="mt-2 max-w-full truncate text-base font-bold text-foreground">
                    {member.ign}
                  </p>
                  {activeGroupId === 'all' && (
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm test -- components/dashboard/TierRankingPodium.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/dashboard/TierRankingPodium.tsx components/dashboard/TierRankingPodium.test.tsx
git commit -m "feat: add tier ranking podium with group tabs"
```

---

### Task 3: 최근 내전 목록 (`components/dashboard/RecentScrimsList.tsx`)

**Files:**
- Create: `components/dashboard/RecentScrimsList.tsx`
- Test: `components/dashboard/RecentScrimsList.test.tsx`

**Interfaces:**
- Consumes: `SCRIM_SESSIONS`, `formatScrimDate` (Task 1의 `@/lib/dashboardData`)
- Produces: `export function RecentScrimsList(): JSX.Element` — props 없음.

Task 5(페이지 조합)가 이 컴포넌트를 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/dashboard/RecentScrimsList.test.tsx`:
```tsx
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RecentScrimsList } from './RecentScrimsList';

afterEach(cleanup);

describe('RecentScrimsList', () => {
  it('renders all ten scrim sessions with title, date, and counts', () => {
    render(<RecentScrimsList />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('2026 RAGE 클랜내전 #18')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 (일) · 64명 참여 · 4경기')).toBeInTheDocument();
  });

  it('links to the replay when a URL is set', () => {
    render(<RecentScrimsList />);
    const item = screen.getByText('2026 RAGE 클랜내전 #18').closest('li')!;
    const link = within(item).getByRole('link', { name: '다시보기' });
    expect(link).toHaveAttribute('href', 'https://youtu.be/rage-scrim-18');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows a disabled placeholder when no replay URL is set yet', () => {
    render(<RecentScrimsList />);
    const item = screen.getByText('2026 RAGE 클랜내전 #16').closest('li')!;
    expect(within(item).getByText('다시보기 준비중')).toBeInTheDocument();
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(within(item).getByText('2026-07-19 (일) · 60명 참여 · 4경기')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- components/dashboard/RecentScrimsList.test.tsx`
Expected: FAIL (`Cannot find module './RecentScrimsList'`)

- [ ] **Step 3: 구현 작성**

`components/dashboard/RecentScrimsList.tsx`:
```tsx
import { SCRIM_SESSIONS, formatScrimDate } from '@/lib/dashboardData';

export function RecentScrimsList() {
  return (
    <section className="mx-auto max-w-shell px-5 pb-24 sm:px-8 md:pb-32">
      <div className="flex items-center gap-4">
        <p className="hud shrink-0 text-[11px] text-accent sm:text-xs">RECENT SCRIMS</p>
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">최근 내전</h2>

      <ul className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {SCRIM_SESSIONS.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div>
              <p className="font-bold text-foreground">{session.title}</p>
              <p className="mt-1 text-sm text-menu">
                {formatScrimDate(session.date)} · {session.participantCount}명 참여 ·{' '}
                {session.matchCount}경기
              </p>
            </div>
            {session.replayUrl ? (
              <a
                href={session.replayUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md border border-accent/50 px-4 py-2 text-center text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-background"
              >
                다시보기
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-center text-sm text-white/25"
              >
                다시보기 준비중
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm test -- components/dashboard/RecentScrimsList.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/dashboard/RecentScrimsList.tsx components/dashboard/RecentScrimsList.test.tsx
git commit -m "feat: add recent scrims list with replay links"
```

---

### Task 4: Nav/Footer의 `ready` 플래그 연결

**Files:**
- Modify: `lib/siteConfig.ts`
- Modify: `components/Nav.tsx`
- Modify: `components/Footer.tsx`
- Test: `components/Nav.test.tsx` (신규)
- Test: `components/Footer.test.tsx` (신규)

**Interfaces:**
- Consumes: 없음 (기존 파일 수정)
- Produces: `siteConfig.nav`의 `DASHBOARD` 항목과 `siteConfig.footer.links`의 `대시보드` 항목이 `ready: true`가 된다. 나머지 항목은 `ready: false` 그대로.

- [ ] **Step 1: 실패하는 테스트 작성 — Nav**

`components/Nav.test.tsx`:
```tsx
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Nav } from './Nav';

afterEach(cleanup);

describe('Nav', () => {
  it('renders DASHBOARD as a real link now that the page exists', () => {
    render(<Nav />);
    const link = screen.getByRole('link', { name: 'DASHBOARD' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('keeps not-yet-built pages disabled', () => {
    render(<Nav />);
    expect(screen.queryByRole('link', { name: 'MEMBERS' })).not.toBeInTheDocument();
    expect(screen.getByText('MEMBERS')).toHaveAttribute('aria-disabled', 'true');
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 — Footer**

`components/Footer.test.tsx`:
```tsx
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('renders 대시보드 as a real link now that the page exists', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: '대시보드' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('keeps not-yet-built pages disabled', () => {
    render(<Footer />);
    expect(screen.queryByRole('link', { name: '클랜원' })).not.toBeInTheDocument();
    expect(screen.getByText('클랜원')).toHaveAttribute('aria-disabled', 'true');
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npm test -- components/Nav.test.tsx components/Footer.test.tsx`
Expected: FAIL (`getByRole('link', { name: 'DASHBOARD' })`와 `{ name: '대시보드' }`를 찾지 못함 — 지금은 둘 다 비활성 span)

- [ ] **Step 4: siteConfig.ts 수정**

`lib/siteConfig.ts`에서 `nav` 배열의 `DASHBOARD` 항목을:
```ts
{ label: 'DASHBOARD', href: '/dashboard', ready: false },
```
다음으로 바꾼다:
```ts
{ label: 'DASHBOARD', href: '/dashboard', ready: true },
```

같은 파일의 `footer.links` 배열의 `대시보드` 항목을:
```ts
{ label: '대시보드', href: '/dashboard', ready: false },
```
다음으로 바꾼다:
```ts
{ label: '대시보드', href: '/dashboard', ready: true },
```

`MEMBERS`/`MATCHES`/`RANKINGS`와 `클랜원`/`매치 기록`/`랭킹`은 손대지 않는다 (`ready: false` 유지).

- [ ] **Step 5: Nav.tsx 수정**

`components/Nav.tsx` 상단에 import 추가:
```tsx
import Link from 'next/link';
```

`<nav aria-label="주요 메뉴" ...>` 내부의 `{siteConfig.nav.map(...)}` 블록을 다음으로 바꾼다:
```tsx
{siteConfig.nav.map((item) =>
  item.ready ? (
    <Link
      key={item.label}
      href={item.href}
      className="hud text-[15px] text-menu transition-colors hover:text-foreground"
    >
      {item.label}
    </Link>
  ) : (
    <span
      key={item.label}
      aria-disabled="true"
      className="hud cursor-not-allowed text-[15px] text-menu transition-colors hover:text-foreground"
    >
      {item.label}
      <span className="sr-only"> (준비 중)</span>
    </span>
  )
)}
```

- [ ] **Step 6: Footer.tsx 수정**

`components/Footer.tsx` 상단에 import 추가:
```tsx
import Link from 'next/link';
```

`<nav aria-label="푸터 메뉴" ...>` 내부의 `{footer.links.map(...)}` 블록을 다음으로 바꾼다:
```tsx
{footer.links.map((link) =>
  link.ready ? (
    <Link
      key={link.label}
      href={link.href}
      className="text-sm text-white/35 transition-colors hover:text-foreground"
    >
      {link.label}
    </Link>
  ) : (
    <span
      key={link.label}
      aria-disabled="true"
      className="cursor-not-allowed text-sm text-white/35"
    >
      {link.label}
      <span className="sr-only"> (준비 중)</span>
    </span>
  )
)}
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `npm test -- components/Nav.test.tsx components/Footer.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 8: 전체 테스트 스위트로 회귀 확인**

Run: `npm test`
Expected: 지금까지 만든 모든 테스트 PASS (Task 1~4 전부 포함)

- [ ] **Step 9: 커밋**

```bash
git add lib/siteConfig.ts components/Nav.tsx components/Footer.tsx components/Nav.test.tsx components/Footer.test.tsx
git commit -m "feat: activate DASHBOARD nav/footer links now that the page exists"
```

---

### Task 5: 대시보드 페이지 조합 (`app/dashboard/page.tsx`)

**Files:**
- Create: `app/dashboard/page.tsx`
- Test: `app/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `Nav` (`@/components/Nav`), `Footer` (`@/components/Footer`), `TierRankingPodium` (Task 2), `RecentScrimsList` (Task 3)

- [ ] **Step 1: 실패하는 테스트 작성**

`app/dashboard/page.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('composes nav, tier ranking, recent scrims, and footer', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('link', { name: 'DASHBOARD' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '티어 랭킹' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '최근 내전' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText(/VERSION/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- app/dashboard/page.test.tsx`
Expected: FAIL (`Cannot find module './page'`)

- [ ] **Step 3: 구현 작성**

`app/dashboard/page.tsx`:
```tsx
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TierRankingPodium } from '@/components/dashboard/TierRankingPodium';
import { RecentScrimsList } from '@/components/dashboard/RecentScrimsList';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <TierRankingPodium />
      <RecentScrimsList />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm test -- app/dashboard/page.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: 전체 테스트 스위트 + 프로덕션 빌드 확인**

Run: `npm test`
Expected: 모든 테스트 PASS (landing page 테스트는 아직 없으므로, Task 1~5에서 만든 테스트 전부)

Run: `npm run build`
Expected: 에러 없이 빌드 성공, `/dashboard` 라우트가 목록에 포함됨

- [ ] **Step 6: 커밋**

```bash
git add app/dashboard/page.tsx app/dashboard/page.test.tsx
git commit -m "feat: compose dashboard page from tier ranking and recent scrims"
```

---

### Task 6: 브라우저 수동 검증

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev`

- [ ] **Step 2: 대시보드 확인**

`http://localhost:3000/dashboard`를 열어 다음을 확인한다:
- 상단에 `전체` 탭이 기본 선택돼 있고, 1위(레이지에이스)가 가운데 가장 크게, 2위가 왼쪽, 3위가 오른쪽에 보이는지
- `전체` 탭에서만 각 카드에 티어 배지(`4.5티어` 등)가 보이는지
- `4~4.5티어` 탭을 클릭하면 1위만 채워지고 2·3위 자리에 "—"가 표시되는지 (빈 슬롯이 자연스럽게 보이는지)
- 나머지 탭(`0~1.5티어`, `2~2.5티어`, `3~3.5티어`)도 클릭했을 때 Top3가 바뀌는지
- 하단 최근 내전 목록에 10개 행이 보이고, 다시보기 URL이 있는 행은 주황 테두리 버튼으로, 없는 행(`#16`, `#13`)은 흐린 "다시보기 준비중"으로 보이는지
- 다시보기 버튼 클릭 시 새 탭으로 열리는지

- [ ] **Step 3: 랜딩페이지 회귀 확인**

`http://localhost:3000`을 열어 다음을 확인한다:
- 상단 네비게이션의 `DASHBOARD`가 이제 실제로 클릭 가능하고 `/dashboard`로 이동하는지
- `MEMBERS`/`MATCHES`/`RANKINGS`는 여전히 비활성 상태인지
- 히어로의 "대시보드 보기" 버튼과 푸터의 "대시보드" 링크도 `/dashboard`로 정상 이동하는지
- 나머지 랜딩페이지 레이아웃(헤드라인, 클랜원 수, 기능 목록, 푸터)이 이전과 동일하게 보이는지

- [ ] **Step 4: 반응형 확인**

브라우저 창을 모바일 크기(375px)로 줄여서 확인한다:
- 티어 탭이 줄바꿈되며 자연스럽게 배치되는지
- 포디움 3개 카드가 가로로 눌리지 않고 보이는지 (필요하면 이 스텝에서 발견한 문제를 기록만 하고, 별도 조정이 필요하면 `lib/siteConfig.ts`처럼 `components/dashboard/TierRankingPodium.tsx`의 Tailwind 클래스만 조정한다)
- 최근 내전 목록 각 행이 세로로 쌓이는지
