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
