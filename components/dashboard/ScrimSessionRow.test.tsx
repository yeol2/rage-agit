import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScrimSessionRow } from './ScrimSessionRow';
import type { ScrimMatch, ScrimParticipant, ScrimSessionSummary } from '@/lib/scrimData';

afterEach(cleanup);

const session: ScrimSessionSummary = {
  id: 'session-1',
  scrimDate: '2026-08-02',
  title: '2026-08-02 (일) 내전',
  sessionNumber: null,
  replayUrl: null,
  matchCount: 4,
  participantCount: 64,
};

const matches: ScrimMatch[] = [
  {
    pubgMatchId: 'm1',
    playedAt: '2026-08-02T11:01:10Z',
    mapName: 'Baltic_Main',
    participantCount: 64,
    source: 'pubg_api',
  },
  {
    pubgMatchId: 'm2',
    playedAt: '2026-08-02T12:39:58Z',
    mapName: 'Desert_Main',
    participantCount: 64,
    source: 'pubg_api',
  },
];

const participants: ScrimParticipant[] = [
  {
    pubgIgn: 'Ez_Gi-Man',
    discordNickname: 'Ez_Gi-Man(기맨/98)',
    teamId: 13,
    teamRank: 1,
    kills: 5,
    assists: 1,
    damageDealt: 612,
    dbnos: 3,
    headshotKills: 2,
    timeSurvived: 1472,
    distance: 6472,
  },
  {
    pubgIgn: 'Ez_Stranger',
    discordNickname: null,
    teamId: 4,
    teamRank: 2,
    kills: 0,
    assists: 0,
    damageDealt: 10,
    dbnos: 0,
    headshotKills: 0,
    timeSurvived: 300,
    distance: 900,
  },
];

describe('ScrimSessionRow', () => {
  it('처음에는 세션 요약만 보여준다', () => {
    render(<ScrimSessionRow session={session} loadMatches={vi.fn()} loadParticipants={vi.fn()} />);
    expect(screen.getByText('2026-08-02 (일) 내전')).toBeInTheDocument();
    expect(screen.queryByText(/1경기/)).not.toBeInTheDocument();
  });

  it('펼치면 그때 경기 목록을 가져온다', async () => {
    const loadMatches = vi.fn().mockResolvedValue(matches);
    render(
      <ScrimSessionRow session={session} loadMatches={loadMatches} loadParticipants={vi.fn()} />,
    );

    expect(loadMatches).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));

    await waitFor(() => expect(screen.getByText(/1경기/)).toBeInTheDocument());
    expect(loadMatches).toHaveBeenCalledWith('session-1');
    expect(screen.getByText(/2경기/)).toBeInTheDocument();
  });

  it('경기를 펼치면 참가자를 팀 순위대로 보여준다', async () => {
    const loadParticipants = vi.fn().mockResolvedValue(participants);
    render(
      <ScrimSessionRow
        session={session}
        loadMatches={vi.fn().mockResolvedValue(matches)}
        loadParticipants={loadParticipants}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));
    await waitFor(() => expect(screen.getByText(/1경기/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /1경기/ }));

    await waitFor(() => expect(screen.getByText('Ez_Gi-Man')).toBeInTheDocument());
    expect(loadParticipants).toHaveBeenCalledWith('m1');
    // 이동거리와 생존시간이 사람이 읽는 형태로 나온다
    expect(screen.getByText('6.47km')).toBeInTheDocument();
    expect(screen.getByText('24:32')).toBeInTheDocument();
  });

  it('명단에 없는 참가자는 별명 없이 IGN 만 보여준다', async () => {
    render(
      <ScrimSessionRow
        session={session}
        loadMatches={vi.fn().mockResolvedValue(matches)}
        loadParticipants={vi.fn().mockResolvedValue(participants)}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));
    await waitFor(() => expect(screen.getByText(/1경기/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /1경기/ }));

    await waitFor(() => expect(screen.getByText('Ez_Stranger')).toBeInTheDocument());
    // 등록된 사람은 별명이 함께 보인다
    expect(screen.getByText('Ez_Gi-Man(기맨/98)')).toBeInTheDocument();
  });

  it('조회가 실패하면 그 자리에만 오류를 보인다', async () => {
    render(
      <ScrimSessionRow
        session={session}
        loadMatches={vi.fn().mockRejectedValue(new Error('네트워크 오류'))}
        loadParticipants={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));
    await waitFor(() => expect(screen.getByText('네트워크 오류')).toBeInTheDocument());
    // 세션 제목은 그대로 보인다 — 목록 전체가 깨지지 않는다
    expect(screen.getByText('2026-08-02 (일) 내전')).toBeInTheDocument();
  });

  it('dak.gg 에서 읽은 경기는 시각을 보여주지 않는다', async () => {
    // dak.gg 에는 날짜까지만 있다. played_at 은 경기 순서를 유지하려고
    // 만든 자리표시자라, 보여주면 20:01 이 사실인 것처럼 읽힌다.
    const dakgg: ScrimMatch[] = [
      {
        pubgMatchId: 'dakgg:abc123',
        playedAt: '2026-07-19T20:01:00+09:00',
        mapName: 'Desert_Main',
        participantCount: 64,
        source: 'dakgg',
      },
    ];
    render(
      <ScrimSessionRow
        session={session}
        loadMatches={vi.fn().mockResolvedValue(dakgg)}
        loadParticipants={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));
    await waitFor(() => expect(screen.getByText(/1경기/)).toBeInTheDocument());
    expect(screen.queryByText('20:01')).not.toBeInTheDocument();
  });

  it('API 에서 받은 경기는 시각을 보여준다', async () => {
    render(
      <ScrimSessionRow
        session={session}
        loadMatches={vi.fn().mockResolvedValue(matches)}
        loadParticipants={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /2026-08-02 \(일\) 내전/ }));
    // 픽스처의 11:01:10Z 는 한국시간 20:01 이다.
    await waitFor(() => expect(screen.getByText('20:01')).toBeInTheDocument());
  });
});
