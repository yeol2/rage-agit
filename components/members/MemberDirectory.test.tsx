import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberDirectory } from './MemberDirectory';
import type { MemberSummary } from '@/lib/memberStats';

afterEach(cleanup);

const members: MemberSummary[] = [
  { id: 'm-1', discordNickname: 'Ez_Alpha', tier: 0 },
  { id: 'm-2', discordNickname: 'Ez_Bravo', tier: 2 },
  { id: 'm-3', discordNickname: 'Ez_Charlie', tier: 5 },
];

describe('MemberDirectory', () => {
  it('티어 그룹별로 묶어서 보여준다', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.getByText('0~1.5티어')).toBeInTheDocument();
    expect(screen.getByText('2~2.5티어')).toBeInTheDocument();
    expect(screen.getByText('4~5티어')).toBeInTheDocument();
    expect(screen.getByText('Ez_Alpha')).toBeInTheDocument();
    expect(screen.getByText('Ez_Charlie')).toBeInTheDocument();
  });

  it('이름을 그 사람 페이지로 가는 링크로 그린다', () => {
    render(<MemberDirectory members={members} />);
    expect(screen.getByRole('link', { name: 'Ez_Alpha' })).toHaveAttribute(
      'href',
      '/members/m-1',
    );
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
    expect(screen.queryByText('0~1.5티어')).not.toBeInTheDocument();
    expect(screen.getByText('2~2.5티어')).toBeInTheDocument();
  });
});
