import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/lib/memberStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/memberStats')>();
  return {
    ...actual,
    fetchMember: vi.fn(),
    fetchMemberRecentStats: vi.fn(),
    fetchMemberWinCount: vi.fn(),
    fetchTierCohortStats: vi.fn(),
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

// eslint-disable-next-line import/first
import MemberDetailPage from './page';
// eslint-disable-next-line import/first
import {
  fetchMember,
  fetchMemberRecentStats,
  fetchMemberWinCount,
  fetchTierCohortStats,
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
  headshotRatio: 0.3,
  avgSurvival: 1200,
  avgAssists: 1,
  avgRank: 5,
};

describe('MemberDetailPage', () => {
  it('충분한 표본이 있으면 6각형을 그린다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([stats]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByRole('heading', { name: 'Ez_Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '6각형 지표' })).toBeInTheDocument();
  });

  it('제목도 명단 화면과 같은 방식으로 괄호 태그를 뗀다', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...member, discordNickname: 'Ez_Alpha(98)' });
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([stats]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByRole('heading', { name: 'Ez_Alpha' })).toBeInTheDocument();
  });

  it('표본이 4경기 미만이면 6각형 대신 안내 문구를 보인다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue({ ...stats, gameCount: 2 });
    vi.mocked(fetchTierCohortStats).mockResolvedValue([]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('아직 내전 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '6각형 지표' })).not.toBeInTheDocument();
  });

  it('전적이 아예 없으면(기록 자체가 없음) 안내 문구를 보인다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(null);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([]);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('아직 내전 기록이 없습니다.')).toBeInTheDocument();
  });

  // 트로피는 svg 라 글자로 셀 수 없다. 광택을 잘라내는 clipPath 안에 트로피가
  // 하나씩 들어가므로 그걸 센다.
  const trophyCount = (container: HTMLElement) =>
    container.querySelectorAll('#win-trophy-clip > g').length;

  it('우승 횟수만큼 트로피를 보인다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(3);

    const { container } = render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('종합우승 3회')).toBeInTheDocument();
    expect(trophyCount(container)).toBe(3);
  });

  it('우승이 없으면 트로피 줄을 아예 안 그린다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(0);

    render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.queryByText(/종합우승/)).not.toBeInTheDocument();
  });

  it('트로피가 너무 많아져도 8개까지만 그리고 숫자는 그대로 센다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(member);
    vi.mocked(fetchMemberRecentStats).mockResolvedValue(stats);
    vi.mocked(fetchTierCohortStats).mockResolvedValue([stats]);
    vi.mocked(fetchMemberWinCount).mockResolvedValue(12);

    const { container } = render(await MemberDetailPage({ params: { memberId: 'm-1' } }));

    expect(screen.getByText('종합우승 12회')).toBeInTheDocument();
    expect(trophyCount(container)).toBe(8);
  });

  it('없는 멤버 id 면 404 처리한다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(null);

    await expect(MemberDetailPage({ params: { memberId: 'nope' } })).rejects.toThrow();
  });
});
