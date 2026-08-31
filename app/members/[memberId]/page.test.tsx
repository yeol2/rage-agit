import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('@/lib/memberStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/memberStats')>();
  return {
    ...actual,
    fetchMember: vi.fn(),
    fetchMemberRecentStats: vi.fn(),
    fetchMemberWinCount: vi.fn(),
    fetchHexagonCohort: vi.fn(),
  };
});

// 대시보드(종합점수 링·최근 내전 등수)는 이 페이지 테스트의 관심사가 아니다 —
// 계산은 memberDashboard.test.ts 가, 그림은 컴포넌트가 따로 덮는다. 여기서는
// 조회가 실제 Supabase 로 새어 나가지 않게만 막는다.
vi.mock('@/lib/rankingStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rankingStats')>();
  return { ...actual, fetchRankingStats: vi.fn().mockResolvedValue([]) };
});

vi.mock('@/lib/memberDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/memberDashboard')>();
  return {
    ...actual,
    fetchRecentSessions: vi.fn().mockResolvedValue([]),
    fetchMemberStandings: vi.fn().mockResolvedValue([]),
  };
});

// 깐부/사대 칸도 같은 이유로 막는다 — 고르는 규칙은 partnerStats.test.ts 가 덮는다.
vi.mock('@/lib/partnerStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/partnerStats')>();
  return {
    ...actual,
    fetchPartnerStats: vi.fn().mockResolvedValue([]),
    fetchPartnerNames: vi.fn().mockResolvedValue(new Map()),
  };
});

// eslint-disable-next-line import/first
import MemberDetailPage from './page';
// eslint-disable-next-line import/first
import {
  fetchMember,
  fetchMemberRecentStats,
  fetchMemberWinCount,
  fetchHexagonCohort,
} from '@/lib/memberStats';

beforeEach(() => {
  // 우승 횟수는 대부분의 테스트가 신경 쓰지 않는다 — 안 세운 테스트가 실제
  // 조회로 새어 나가지 않게 기본값을 둔다.
  vi.mocked(fetchMemberWinCount).mockResolvedValue(0);
});

afterEach(cleanup);

const member = { id: 'm-1', discordNickname: 'Ez_Alpha', tier: 2, vipRank: null };
const stats = {
  memberId: 'm-1',
  tier: 2,
  gameCount: 10,
  avgDamage: 200,
  avgKills: 2,
  rankStddev: 3,
  avgSurvival: 1200,
  avgAssists: 1,
  avgRank: 5,
};

describe('MemberDetailPage', () => {
  it('충분한 표본이 있으면 6각형을 그린다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([stats]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByRole('heading', { name: 'Ez_Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^6각형 지표/ })).toBeInTheDocument();
  });

  it('제목도 명단 화면과 같은 방식으로 괄호 태그를 뗀다', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...member, discordNickname: 'Ez_Alpha(98)' });
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([stats]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByRole('heading', { name: 'Ez_Alpha' })).toBeInTheDocument();
  });

  it('표본이 4경기 미만이면 6각형 대신 안내 문구를 보인다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue({ ...stats, gameCount: 2 });
    vi.mocked(fetchHexagonCohort).mockResolvedValue([]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('아직 내전 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^6각형 지표/ })).not.toBeInTheDocument();
  });

  it('전적이 아예 없으면(기록 자체가 없음) 안내 문구를 보인다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(null);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('아직 내전 기록이 없습니다.')).toBeInTheDocument();
  });

  it('우승 횟수를 트로피 하나에 숫자로 얹는다 — 리더보드 뱃지와 같은 모양이다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(3);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    const badge = screen.getByTestId('win-badge');
    expect(badge.querySelectorAll('svg')).toHaveLength(1);
    expect(within(badge).getByText('3')).toBeInTheDocument();
    // 횟수는 뱃지가 말하므로 뱃지 옆 글자에는 숫자를 또 적지 않는다.
    expect(badge.closest('p')!.textContent!.endsWith('종합우승')).toBe(true);
  });

  it('우승이 없으면 트로피 줄을 아예 안 그린다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(0);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.queryByText(/종합우승/)).not.toBeInTheDocument();
  });

  it('우승이 아무리 많아도 트로피는 하나다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchHexagonCohort).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(12);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    const badge = screen.getByTestId('win-badge');
    expect(badge.querySelectorAll('svg')).toHaveLength(1);
    expect(within(badge).getByText('12')).toBeInTheDocument();
  });

  it('없는 멤버 id 면 404 처리한다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(null);

    await expect(MemberDetailPage({ params: { memberId: 'nope' } })).rejects.toThrow();
  });
});
