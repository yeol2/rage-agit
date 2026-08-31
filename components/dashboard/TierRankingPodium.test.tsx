import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { TierRankingPodium } from './TierRankingPodium';
import { useAdmin } from '@/components/admin/AdminProvider';
import type { RankingStatsRow } from '@/lib/rankingStats';

afterEach(cleanup);

function row(overrides: Partial<RankingStatsRow>): RankingStatsRow {
  return {
    memberId: 'm',
    discordNickname: 'M',
    tier: 0,
    totalGameCount: 20,
    windowGameCount: 20,
    avgKills: 1,
    avgPlacementPoints: 1,
    avgRank: 5,
    lastPlayedAt: new Date().toISOString(),
    winCount: 0,
    ...overrides,
  };
}

const RECENT16: RankingStatsRow[] = [
  row({ memberId: 'a', discordNickname: 'A', tier: 0, totalGameCount: 20, avgKills: 3, avgPlacementPoints: 8 }),
  row({ memberId: 'b', discordNickname: 'B', tier: 0, totalGameCount: 20, avgKills: 5, avgPlacementPoints: 5 }),
  row({ memberId: 'c', discordNickname: 'C', tier: 0, totalGameCount: 8, avgKills: 10, avgPlacementPoints: 10 }),
  row({ memberId: 'd', discordNickname: 'D', tier: 2, totalGameCount: 20, avgKills: 2, avgPlacementPoints: 6 }),
  row({ memberId: 'e', discordNickname: 'E', tier: 2, totalGameCount: 20, avgKills: 2.5, avgPlacementPoints: 4 }),
  row({ memberId: 'f', discordNickname: 'F', tier: 2, totalGameCount: 20, avgKills: 1, avgPlacementPoints: 3 }),
  row({ memberId: 'g', discordNickname: 'G', tier: 4.5, totalGameCount: 20, avgKills: 1, avgPlacementPoints: 2 }),
];

const ALLTIME: RankingStatsRow[] = [
  row({ memberId: 'a', discordNickname: 'A', tier: 0, totalGameCount: 40, avgKills: 2, avgPlacementPoints: 3 }),
  row({ memberId: 'b', discordNickname: 'B', tier: 0, totalGameCount: 40, avgKills: 4, avgPlacementPoints: 9 }),
  row({ memberId: 'c', discordNickname: 'C', tier: 0, totalGameCount: 8, avgKills: 10, avgPlacementPoints: 10 }),
  row({ memberId: 'd', discordNickname: 'D', tier: 2, totalGameCount: 30, avgKills: 2, avgPlacementPoints: 6 }),
  row({ memberId: 'e', discordNickname: 'E', tier: 2, totalGameCount: 30, avgKills: 2.5, avgPlacementPoints: 4 }),
  row({ memberId: 'f', discordNickname: 'F', tier: 2, totalGameCount: 30, avgKills: 1, avgPlacementPoints: 2.5 }),
  row({ memberId: 'g', discordNickname: 'G', tier: 4.5, totalGameCount: 40, avgKills: 1, avgPlacementPoints: 2 }),
];

describe('TierRankingPodium', () => {
  it('기본값(전체/종합점수/최근16매치)으로 점수 내림차순 top3를 채우고 티어 배지를 보여준다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    // 티어별 킬 가중치(0티어=1) 적용 후: A 73.11 > D 72.44 > E 60.14.
    expect(within(slot1).getByText('A')).toBeInTheDocument();
    expect(within(slot1).getByText('0티어')).toBeInTheDocument();
    expect(within(slot2).getByText('D')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('자격 미달(통산 16경기 미만) 인원은 최고 스탯이어도 랭킹에서 빠진다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '평균킬' }));
    expect(screen.queryByText('C')).not.toBeInTheDocument();
  });

  it('평균킬 탭으로 바꾸면 평균킬 기준 순서로 다시 채운다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '평균킬' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('B')).toBeInTheDocument();
    expect(within(slot2).getByText('A')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('역대 전체 탭으로 바꾸면 통산 데이터로 다시 채운다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: '역대 전체' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    // 티어별 킬 가중치 적용 후: B 73.11 > D 71.94 > E 60.90.
    expect(within(slot1).getByText('B')).toBeInTheDocument();
    expect(within(slot2).getByText('D')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('티어 탭을 고르면 그 그룹만 보여준다. 인원이 모자라면 빈 슬롯', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: '4~5티어' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('G')).toBeInTheDocument();
    expect(within(slot1).getByText('4.5티어')).toBeInTheDocument();
    expect(within(slot2).getByText('—')).toBeInTheDocument();
    expect(within(slot3).getByText('—')).toBeInTheDocument();
  });

  it('관리자면 전체 탭 40명/티어별 10명 제한 없이 인원 전부를 랭킹에 넣는다', () => {
    vi.mocked(useAdmin).mockReturnValueOnce({ isAdmin: true, login: vi.fn(), logout: vi.fn() });
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);

    // RECENT16의 자격자는 A/B/D/E/F/G(6명) — C는 16경기 미만이라 관리자여도 빠진다.
    expect(screen.getByText(/총 6명 중 6명/)).toBeInTheDocument();
  });
});

describe('TierRankingPodium — 관리자 검색', () => {
  it('일반 사용자에게는 검색창이 안 보인다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    expect(screen.queryByPlaceholderText('닉네임 검색')).not.toBeInTheDocument();
  });

  it('관리자는 검색창으로 4위 이하 표를 닉네임 부분일치로 필터링할 수 있다', () => {
    // 기본값(전체/종합점수) 기준 top3는 A/D/E — 4위 이하 표에 B/F/G가 남는다.
    vi.mocked(useAdmin).mockReturnValue({ isAdmin: true, login: vi.fn(), logout: vi.fn() });
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);

    const input = screen.getByPlaceholderText('닉네임 검색');
    fireEvent.change(input, { target: { value: 'f' } });

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('G')).not.toBeInTheDocument();
  });

  it('검색 결과가 없으면 안내 문구를 보여준다', () => {
    vi.mocked(useAdmin).mockReturnValue({ isAdmin: true, login: vi.fn(), logout: vi.fn() });
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);

    fireEvent.change(screen.getByPlaceholderText('닉네임 검색'), { target: { value: '없는이름' } });
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('검색 중에도 시상대(top3)는 그대로 남는다', () => {
    vi.mocked(useAdmin).mockReturnValue({ isAdmin: true, login: vi.fn(), logout: vi.fn() });
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);

    fireEvent.change(screen.getByPlaceholderText('닉네임 검색'), { target: { value: '없는이름' } });
    expect(within(screen.getByTestId('podium-slot-1')).getByText('A')).toBeInTheDocument();
  });
});

describe('TierRankingPodium — 뱃지(종합우승)', () => {
  // 뱃지 열은 4위 이하 표에만 있다(1~3위는 시상대라 열 자체가 없다).
  const badge = (row: HTMLElement) => within(row).getByTestId('win-badge');

  it('우승 횟수를 트로피 하나에 숫자로 얹는다', () => {
    const withWins = RECENT16.map((r) => ({ ...r, winCount: 3 }));
    render(<TierRankingPodium recent16={withWins} alltime={ALLTIME} snapshots={[]} />);

    const row4 = screen.getByTestId('ranking-row-4');
    expect(within(row4).getByTitle('종합우승 3회')).toBeInTheDocument();
    expect(badge(row4).querySelectorAll('svg')).toHaveLength(1);
    expect(within(badge(row4)).getByText('3')).toBeInTheDocument();
  });

  // 예전에는 횟수만큼 트로피를 늘어놓느라 우승이 쌓이면 뱃지 칸을 넘겼다.
  it('우승이 아무리 많아도 트로피는 하나다', () => {
    const withWins = RECENT16.map((r) => ({ ...r, winCount: 11 }));
    render(<TierRankingPodium recent16={withWins} alltime={ALLTIME} snapshots={[]} />);

    const row4 = screen.getByTestId('ranking-row-4');
    expect(badge(row4).querySelectorAll('svg')).toHaveLength(1);
    expect(within(badge(row4)).getByText('11')).toBeInTheDocument();
    expect(within(row4).getByTitle('종합우승 11회')).toBeInTheDocument();
  });

  it('우승이 없으면 뱃지 칸이 - 로 남는다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    const row4 = screen.getByTestId('ranking-row-4');
    expect(within(row4).getByText('-')).toBeInTheDocument();
    expect(within(row4).queryByTitle(/종합우승/)).not.toBeInTheDocument();
  });
});

describe('TierRankingPodium — 등수 변화', () => {
  it('종합점수 탭에서 이전보다 등수가 오르면 빨간 상승 표시를 낸다', () => {
    // recent16/전체 기준 D가 2위 — 스냅샷에서 D가 3위였다면 1계단 상승.
    const snapshots = [
      { window: 'recent16' as const, groupId: 'all', memberId: 'd', rankPosition: 2, previousRankPosition: 3 },
    ];
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={snapshots} />);
    expect(screen.getByText('▲1')).toBeInTheDocument();
  });

  it('스냅샷에 없던 사람은 NEW를 보여준다', () => {
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={[]} />);
    expect(within(screen.getByTestId('podium-slot-1')).getByText('NEW')).toBeInTheDocument();
  });

  // 0031 이전에 캡처된 행은 previousRankPosition 이 없다(그 전 세션 값을 되살릴
  // 방법이 없다) — rankPosition(예전 방식)으로 물러나 "변동 없음"처럼 조용히
  // 보여야 한다. 그렇지 않으면 이미 랭킹에 있던 사람들이 전부 NEW로 도배된다.
  // rankPosition 값 자체은 안 맞아도 상관없다(위/아래 화살표가 나올 순 있어도
  // NEW 만 아니면 된다) — 여기서 확인하려는 건 "행이 있으면 undefined 로
  // 안 떨어진다"는 것뿐이다.
  it('previousRankPosition 이 없으면(0031 이전 캡처) NEW로 도배하지 않고 조용히 넘어간다', () => {
    const snapshots = ['a', 'b', 'd', 'e', 'f', 'g'].map((memberId) => ({
      window: 'recent16' as const,
      groupId: 'all',
      memberId,
      rankPosition: 1,
      previousRankPosition: null,
    }));
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={snapshots} />);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('평균킬 탭에서는 스냅샷이 있어도 변화 표시를 안 한다', () => {
    const snapshots = [
      { window: 'recent16' as const, groupId: 'all', memberId: 'd', rankPosition: 2, previousRankPosition: 3 },
    ];
    render(<TierRankingPodium recent16={RECENT16} alltime={ALLTIME} snapshots={snapshots} />);
    fireEvent.click(screen.getByRole('button', { name: '평균킬' }));
    expect(screen.queryByText('▲2')).not.toBeInTheDocument();
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });
});
