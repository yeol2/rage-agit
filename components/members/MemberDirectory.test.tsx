import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberDirectory } from './MemberDirectory';
import type { MemberSummary } from '@/lib/memberStats';

afterEach(cleanup);

const members: MemberSummary[] = [
  { id: 'm-1', discordNickname: 'Ez_Alpha(98)', tier: 0, vipRank: null },
  { id: 'm-2', discordNickname: 'Ez_Bravo👀', tier: 2, vipRank: null },
  { id: 'm-3', discordNickname: 'Ez_Charlie', tier: 2.5, vipRank: null },
  { id: 'm-4', discordNickname: 'Ez_Delta', tier: 5, vipRank: null },
];

describe('MemberDirectory', () => {
  it('0~5티어를 전부 따로 묶어서 보여준다(4개 그룹이 아니라 티어별로)', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.getByText('0티어')).toBeInTheDocument();
    expect(screen.getByText('2티어')).toBeInTheDocument();
    expect(screen.getByText('2.5티어')).toBeInTheDocument();
    expect(screen.getByText('5티어')).toBeInTheDocument();
    // 2티어와 2.5티어가 하나로 안 묶인다는 뜻이다.
    expect(screen.queryByText('2~2.5티어')).not.toBeInTheDocument();
  });

  it('괄호 태그와 이모지를 뗀 이름만 보여준다', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.getByText('Ez_Alpha')).toBeInTheDocument();
    expect(screen.getByText('Ez_Bravo')).toBeInTheDocument();
    expect(screen.queryByText('Ez_Alpha(98)')).not.toBeInTheDocument();
    expect(screen.queryByText('Ez_Bravo👀')).not.toBeInTheDocument();
  });

  it('이름을 그 사람 페이지로 가는 링크로 그린다', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.getByRole('link', { name: 'Ez_Alpha' })).toHaveAttribute(
      'href',
      '/members/m-1',
    );
  });

  it('같은 티어끼리는 같은 배색을 쓴다', () => {
    render(<MemberDirectory members={members} />);
    const bravo = screen.getByRole('link', { name: 'Ez_Bravo' });
    const charlie = screen.getByRole('link', { name: 'Ez_Charlie' });
    // 2티어와 2.5티어는 tierColorRamp 상 같은 배색을 공유한다.
    expect(bravo.style.borderColor).toBe(charlie.style.borderColor);
  });

  it('검색하면 일치하는 이름만 남는다', async () => {
    render(<MemberDirectory members={members} />);
    await userEvent.type(screen.getByPlaceholderText('닉네임 검색'), 'bravo');
    expect(screen.queryByText('Ez_Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Ez_Bravo')).toBeInTheDocument();
  });

  it('검색으로 그룹이 통째로 비면 그 그룹 제목도 숨긴다', async () => {
    render(<MemberDirectory members={members} />);
    await userEvent.type(screen.getByPlaceholderText('닉네임 검색'), 'bravo');
    expect(screen.queryByText('0티어')).not.toBeInTheDocument();
    expect(screen.getByText('2티어')).toBeInTheDocument();
  });

  it('VIP가 없으면 VIP 섹션 자체가 안 뜬다', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });

  it('티어 네임플레이트에는 VIP 인 사람에게만 왕관이 붙는다', () => {
    const withVip: MemberSummary[] = [
      { id: 'm-1', discordNickname: 'Ez_Alpha', tier: 0, vipRank: null },
      { id: 'm-5', discordNickname: 'Ez_Echo', tier: 3, vipRank: 2 },
    ];
    const { container } = render(<MemberDirectory members={withVip} />);

    const crowns = container.querySelectorAll('img[src="/vip-crown.svg"]');
    // VIP 섹션(1개) + 3티어 섹션의 Ez_Echo(1개) — Ez_Alpha 에는 안 붙는다.
    const tierSectionCrowns = Array.from(crowns).filter(
      (img) => !img.parentElement?.querySelector('.vip-holographic'),
    );
    expect(tierSectionCrowns).toHaveLength(1);
    expect(tierSectionCrowns[0].parentElement?.textContent).toBe('Ez_Echo');
  });

  it('VIP는 등수 순으로 보여주고, 자기 티어 섹션에도 그대로 남는다(중복 표시)', () => {
    const withVips: MemberSummary[] = [
      ...members,
      { id: 'm-5', discordNickname: 'Ez_Echo', tier: 3, vipRank: 2 },
      { id: 'm-6', discordNickname: 'Ez_Foxtrot', tier: 1, vipRank: 1 },
    ];
    render(<MemberDirectory members={withVips} />);
    expect(screen.getByText('VIP')).toBeInTheDocument();

    const vipLinks = screen.getAllByRole('link').filter((link) => link.className.includes('vip-holographic'));
    expect(vipLinks.map((link) => link.textContent)).toEqual(['Ez_Foxtrot', 'Ez_Echo']);

    // 3티어 섹션에도 Ez_Echo가 그대로 나온다 — VIP라고 티어 섹션에서 빠지지 않는다.
    expect(screen.getByText('3티어')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Ez_Echo' }).some((link) => !link.className.includes('vip-holographic')),
    ).toBe(true);
  });
});
