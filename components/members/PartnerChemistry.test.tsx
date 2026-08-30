import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PartnerChemistry } from './PartnerChemistry';
import type { PartnerCard } from '@/lib/partnerStats';

afterEach(cleanup);

const good: PartnerCard = {
  partnerId: 'p-1',
  displayName: 'Ez_Yellow',
  tier: 2,
  gamesTogether: 12,
  avgRankTogether: 2.4,
  avgRankApart: 9.1,
  rankDelta: 6.7,
};

const bad: PartnerCard = {
  partnerId: 'p-2',
  displayName: 'Ez_Ttang',
  tier: 3,
  gamesTogether: 8,
  avgRankTogether: 11.8,
  avgRankApart: 5.6,
  rankDelta: -6.2,
};

describe('PartnerChemistry', () => {
  it('두 칸에 이름과 등수 차이를 보인다', () => {
    render(<PartnerChemistry best={good} worst={bad} />);

    const best = screen.getByTestId('partner-best');
    expect(within(best).getByText('Ez_Yellow')).toBeInTheDocument();
    expect(within(best).getByText(/6\.7등/)).toBeInTheDocument();
    expect(within(best).getByText(/함께 12경기 · 평균 2\.4등/)).toBeInTheDocument();

    const worst = screen.getByTestId('partner-worst');
    expect(within(worst).getByText('Ez_Ttang')).toBeInTheDocument();
    // 나빠진 쪽도 절댓값으로 적는다 — 부호는 ▼ 와 '나빠짐'이 맡는다.
    expect(within(worst).getByText(/6\.2등/)).toBeInTheDocument();
  });

  it('이름을 누르면 그 사람 페이지로 간다', () => {
    render(<PartnerChemistry best={good} worst={bad} />);
    expect(screen.getByRole('link', { name: 'Ez_Yellow' })).toHaveAttribute(
      'href',
      '/members/p-1',
    );
  });

  it('후보가 없는 쪽은 빈 칸이 아니라 이유를 적는다', () => {
    render(<PartnerChemistry best={null} worst={bad} />);

    const best = screen.getByTestId('partner-best');
    expect(within(best).getByText(/8경기 이상 같은 팀이었던 사람이 없습니다/)).toBeInTheDocument();
  });
});
