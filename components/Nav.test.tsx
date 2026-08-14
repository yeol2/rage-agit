import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Nav } from './Nav';

afterEach(cleanup);

describe('Nav', () => {
  it('renders 대시보드 as a real link now that the page exists', () => {
    render(<Nav />);
    const link = screen.getByRole('link', { name: '대시보드' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders 클랜원 as a real link now that the page exists', () => {
    render(<Nav />);
    const link = screen.getByRole('link', { name: '클랜원' });
    expect(link).toHaveAttribute('href', '/members');
  });

  it('renders 매치 기록 as a real link now that the page exists', () => {
    render(<Nav />);
    const link = screen.getByRole('link', { name: '매치 기록' });
    expect(link).toHaveAttribute('href', '/matches');
  });
});
