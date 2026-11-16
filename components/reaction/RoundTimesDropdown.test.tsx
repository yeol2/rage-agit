import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundTimesDropdown } from './RoundTimesDropdown';

afterEach(cleanup);

describe('RoundTimesDropdown', () => {
  it('lists the five round times and marks the fastest', () => {
    render(<RoundTimesDropdown name="Ez_Code" times={[151, 147, 157, 154, 157]} />);
    const chips = screen.getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual(['151ms', '147ms', '157ms', '154ms', '157ms']);
    expect(chips[1].className).toContain('text-accent');
    expect(chips[0].className).not.toContain('text-accent');
  });

  it('says there are no round times for records saved before they were stored', () => {
    render(<RoundTimesDropdown name="Ez_Code" times={null} />);
    expect(screen.getByText(/회차 기록 없음/)).toBeInTheDocument();
  });

  it('opens on tap for devices without hover', async () => {
    render(<RoundTimesDropdown name="Ez_Code" times={[151, 147, 157, 154, 157]} />);
    const button = screen.getByRole('button', { name: 'Ez_Code 5회 기록 보기' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
