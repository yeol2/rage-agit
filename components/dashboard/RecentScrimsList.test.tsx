import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RecentScrimsList } from './RecentScrimsList';

afterEach(cleanup);

describe('RecentScrimsList', () => {
  it('renders all ten scrim sessions with title, date, and counts', () => {
    render(<RecentScrimsList />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('2026 RAGE 클랜내전 #18')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 (일) · 64명 참여 · 4경기')).toBeInTheDocument();
  });

  it('links to the replay when a URL is set', () => {
    render(<RecentScrimsList />);
    const item = screen.getByText('2026 RAGE 클랜내전 #18').closest('li')!;
    const link = within(item).getByRole('link', { name: '다시보기' });
    expect(link).toHaveAttribute('href', 'https://youtu.be/rage-scrim-18');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows a disabled placeholder when no replay URL is set yet', () => {
    render(<RecentScrimsList />);
    const item = screen.getByText('2026 RAGE 클랜내전 #16').closest('li')!;
    expect(within(item).getByText('다시보기 준비중')).toBeInTheDocument();
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(within(item).getByText('2026-07-19 (일) · 60명 참여 · 4경기')).toBeInTheDocument();
  });
});
