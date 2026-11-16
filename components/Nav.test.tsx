import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from './Nav';

afterEach(cleanup);

describe('Nav', () => {
  it('renders 리더보드 as a real link now that the page exists', () => {
    render(<Nav />);
    const link = screen.getByRole('link', { name: '리더보드' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('놀이터 is a button that opens a menu, not a link', async () => {
    render(<Nav />);
    const button = screen.getByRole('button', { name: /놀이터/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts 내전 기록 · 클랜원 · 반응속도 테스트 inside 놀이터', () => {
    render(<Nav />);
    expect(screen.getByRole('link', { name: /^내전 기록/ })).toHaveAttribute('href', '/matches');
    expect(screen.getByRole('link', { name: /^클랜원/ })).toHaveAttribute('href', '/members');
    expect(screen.getByRole('link', { name: /^반응속도 테스트/ })).toHaveAttribute('href', '/reaction');
  });
});
