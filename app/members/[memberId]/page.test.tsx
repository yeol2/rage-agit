import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/lib/memberStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/memberStats')>();
  return {
    ...actual,
    fetchMember: vi.fn(),
    fetchMemberRecentStats: vi.fn(),
    fetchTierCohortStats: vi.fn(),
  };
});

// eslint-disable-next-line import/first
import MemberDetailPage from './page';
// eslint-disable-next-line import/first
import { fetchMember, fetchMemberRecentStats, fetchTierCohortStats } from '@/lib/memberStats';

// 이 페이지 테스트의 관심사는 데이터 분기(충분/부족/없음/404)지 게이트 자체가
// 아니다 — 게이트 동작은 AccessGate.test.tsx 가 이미 덮는다. 미리 풀어두면
// 잠긴 동안 자식이 aria-hidden 처리되는 것과 안 부딪힌다.
beforeEach(() => {
  window.localStorage.setItem('rage-members-unlocked', 'true');
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

  it('없는 멤버 id 면 404 처리한다', async () => {
    vi.mocked(fetchMember).mockResolvedValue(null);

    await expect(MemberDetailPage({ params: { memberId: 'nope' } })).rejects.toThrow();
  });
});
