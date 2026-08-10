import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('renders 대시보드 as a real link now that the page exists', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: '대시보드' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders 클랜원 as a real link now that the page exists', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: '클랜원' });
    expect(link).toHaveAttribute('href', '/members');
  });

  it('keeps not-yet-built pages disabled', () => {
    render(<Footer />);
    expect(screen.queryByRole('link', { name: '매치 기록' })).not.toBeInTheDocument();
    expect(screen.getByText('매치 기록')).toHaveAttribute('aria-disabled', 'true');
  });
});
