import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { TierRankingPodium } from './TierRankingPodium';
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
    ...overrides,
  };
}

const RECENT10: RankingStatsRow[] = [
  row({ memberId: 'a', discordNickname: 'A', tier: 0, totalGameCount: 20, avgKills: 3, avgPlacementPoints: 8 }),
  row({ memberId: 'b', discordNickname: 'B', tier: 0, totalGameCount: 20, avgKills: 5, avgPlacementPoints: 5 }),
  row({ memberId: 'c', discordNickname: 'C', tier: 0, totalGameCount: 8, avgKills: 10, avgPlacementPoints: 10 }),
  row({ memberId: 'd', discordNickname: 'D', tier: 2, totalGameCount: 15, avgKills: 2, avgPlacementPoints: 6 }),
  row({ memberId: 'e', discordNickname: 'E', tier: 2, totalGameCount: 15, avgKills: 2.5, avgPlacementPoints: 4 }),
  row({ memberId: 'f', discordNickname: 'F', tier: 2, totalGameCount: 15, avgKills: 1, avgPlacementPoints: 3 }),
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
  it('기본값(전체/종합점수/최근12매치)으로 점수 내림차순 top3를 채우고 티어 배지를 보여준다', () => {
    render(<TierRankingPodium recent12={RECENT10} alltime={ALLTIME} />);
    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('D')).toBeInTheDocument();
    expect(within(slot1).getByText('2티어')).toBeInTheDocument();
    expect(within(slot2).getByText('A')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('자격 미달(통산 12경기 미만) 인원은 최고 스탯이어도 랭킹에서 빠진다', () => {
    render(<TierRankingPodium recent12={RECENT10} alltime={ALLTIME} />);
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '평균킬' }));
    expect(screen.queryByText('C')).not.toBeInTheDocument();
  });

  it('평균킬 탭으로 바꾸면 평균킬 기준 순서로 다시 채운다', () => {
    render(<TierRankingPodium recent12={RECENT10} alltime={ALLTIME} />);
    fireEvent.click(screen.getByRole('button', { name: '평균킬' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('B')).toBeInTheDocument();
    expect(within(slot2).getByText('A')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('역대 전체 탭으로 바꾸면 통산 데이터로 다시 채운다', () => {
    render(<TierRankingPodium recent12={RECENT10} alltime={ALLTIME} />);
    fireEvent.click(screen.getByRole('tab', { name: '역대 전체' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('D')).toBeInTheDocument();
    expect(within(slot2).getByText('B')).toBeInTheDocument();
    expect(within(slot3).getByText('E')).toBeInTheDocument();
  });

  it('티어 탭을 고르면 그 그룹만 보여준다. 인원이 모자라면 빈 슬롯', () => {
    render(<TierRankingPodium recent12={RECENT10} alltime={ALLTIME} />);
    fireEvent.click(screen.getByRole('tab', { name: '4~5티어' }));

    const slot1 = screen.getByTestId('podium-slot-1');
    const slot2 = screen.getByTestId('podium-slot-2');
    const slot3 = screen.getByTestId('podium-slot-3');

    expect(within(slot1).getByText('G')).toBeInTheDocument();
    expect(within(slot1).getByText('4.5티어')).toBeInTheDocument();
    expect(within(slot2).getByText('—')).toBeInTheDocument();
    expect(within(slot3).getByText('—')).toBeInTheDocument();
  });
});
