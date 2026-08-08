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
