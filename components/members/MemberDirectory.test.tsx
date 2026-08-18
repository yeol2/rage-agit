import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberDirectory } from './MemberDirectory';
import type { MemberSummary } from '@/lib/memberStats';

afterEach(cleanup);

const members: MemberSummary[] = [
  { id: 'm-1', discordNickname: 'Ez_Alpha(98)', tier: 0 },
  { id: 'm-2', discordNickname: 'Ez_Bravo👀', tier: 2 },
  { id: 'm-3', discordNickname: 'Ez_Charlie', tier: 2.5 },
  { id: 'm-4', discordNickname: 'Ez_Delta', tier: 5 },
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

  it('같은 색 묶음이어도 반티어는 무채색 테두리를 써서 정수 티어와 구분한다', () => {
    render(<MemberDirectory members={members} />);
    const bravo = screen.getByRole('link', { name: 'Ez_Bravo' }); // 2티어
    const charlie = screen.getByRole('link', { name: 'Ez_Charlie' }); // 2.5티어
    expect(bravo.style.borderColor).not.toBe(charlie.style.borderColor);
    expect(charlie.style.borderColor).toBe('rgba(255, 255, 255, 0.55)');
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
});
