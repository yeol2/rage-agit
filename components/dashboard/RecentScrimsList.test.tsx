import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RecentScrimsList } from './RecentScrimsList';
import type { ScrimSessionSummary } from '@/lib/scrimData';

afterEach(cleanup);

const sessions: ScrimSessionSummary[] = [
  {
    id: 's1',
    scrimDate: '2026-08-09',
    title: '2026-08-09 (일) 내전',
    sessionNumber: null,
    replayUrl: 'https://youtu.be/rage-scrim',
    matchCount: 4,
    participantCount: 64,
  },
  {
    id: 's2',
    scrimDate: '2026-07-26',
    title: '2026-07-26 (일) 내전',
    sessionNumber: null,
    replayUrl: null,
    matchCount: 2,
    participantCount: 68,
  },
];

describe('RecentScrimsList', () => {
  it('내전마다 제목과 인원·경기 수를 보여준다', () => {
    render(<RecentScrimsList sessions={sessions} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('2026-08-09 (일) 내전')).toBeInTheDocument();
    expect(screen.getByText('64명 참여 · 4경기')).toBeInTheDocument();
    expect(screen.getByText('68명 참여 · 2경기')).toBeInTheDocument();
  });

  it('다시보기 URL 이 있으면 링크를 건다', () => {
    render(<RecentScrimsList sessions={sessions} />);
    const link = screen.getByRole('link', { name: '다시보기' });
    expect(link).toHaveAttribute('href', 'https://youtu.be/rage-scrim');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('다시보기가 없으면 준비중으로 보여준다', () => {
    render(<RecentScrimsList sessions={sessions} />);
    expect(screen.getByText('준비중')).toBeInTheDocument();
  });

  it('수집된 내전이 없으면 안내를 보여준다', () => {
    render(<RecentScrimsList sessions={[]} />);
    expect(screen.getByText('아직 수집된 내전이 없습니다.')).toBeInTheDocument();
  });
});
