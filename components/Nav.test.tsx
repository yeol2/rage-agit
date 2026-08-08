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
