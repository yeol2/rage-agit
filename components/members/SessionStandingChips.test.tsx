import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SessionStandingChips } from './SessionStandingChips';

afterEach(cleanup);

describe('SessionStandingChips', () => {
  it('저티어 내전 회차의 칩에만 저티어 내전이라고 적는다', () => {
    render(
      <SessionStandingChips
        sessions={[
          { scrimDate: '2026-09-28', label: '09-28(일)', lowTier: false },
          { scrimDate: '2026-10-01', label: '10-01(수)', lowTier: true },
        ]}
        standingByDate={new Map([['2026-10-01', 1]])}
      />,
    );

    expect(within(screen.getByTestId('standing-chip-2026-10-01')).getByText('저티어 내전')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-chip-2026-09-28')).queryByText('저티어 내전')).not.toBeInTheDocument();
  });
});
