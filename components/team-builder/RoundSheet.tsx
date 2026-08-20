'use client';

import { Fragment, useEffect, useState } from 'react';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';

interface RoundSheetRound {
  roundNo: number;
  kills: number | null;
  teamRank: number | null;
  cumulativeTotal: number;
}

interface RoundSheetTeam {
  teamNumber: number;
  place: number;
  players: string[];
  totalKills: number;
  totalScore: number;
  rounds: RoundSheetRound[];
}

interface RoundSheetResponse {
  roundCount: number;
  teams: RoundSheetTeam[];
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function cleanName(name: string): string {
  return stripTrailingKoreanTag(cleanDisplayName(name));
}

export function RoundSheet({ rosterId }: { rosterId: string }) {
  const [data, setData] = useState<RoundSheetResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState<string | null>(null);

  async function loadSheet() {
    try {
      const response = await fetch(`/api/scrim-roster/round-sheet?rosterId=${rosterId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '시트를 불러오지 못했습니다.');
      setData(body as RoundSheetResponse);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '시트를 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    void loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterId]);

  async function handlePoll() {
    setPolling(true);
    setPollMessage(null);
    try {
      const response = await fetch('/api/scrim-roster/round-sheet/poll', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '폴링에 실패했습니다.');

      if (body.found) {
        await loadSheet();
      } else {
        setPollMessage('아직 새 경기가 없습니다.');
      }
    } catch (err) {
      setPollMessage(err instanceof Error ? err.message : '폴링에 실패했습니다.');
    } finally {
      setPolling(false);
    }
  }

  if (loadError) return <p className="mt-4 text-sm text-red-400">{loadError}</p>;
  if (!data) return <p className="mt-4 text-sm text-menu">불러오는 중…</p>;

  const rounds = Array.from({ length: data.roundCount }, (_, i) => i + 1);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="hud text-xs text-menu">경기 {data.roundCount}개 기록됨</h3>
        <button
          type="button"
          onClick={() => void handlePoll()}
          disabled={polling}
          className="rounded-md border border-accent bg-accent px-4 py-2 text-xs font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          {polling ? '폴링 중…' : '폴링'}
        </button>
      </div>
      {pollMessage && <p className="mt-2 text-xs text-menu">{pollMessage}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-white/10 p-1.5 text-left">순위</th>
              <th className="border-b border-white/10 p-1.5 text-left">팀</th>
              <th className="border-b border-white/10 p-1.5 text-left">PLAYER</th>
              <th className="border-b border-white/10 p-1.5 text-right">KILL</th>
              <th className="border-b border-white/10 p-1.5 text-right">TOTAL</th>
              {rounds.map((roundNo) => (
                <th key={roundNo} className="border-b border-white/10 p-1.5 text-center" colSpan={3}>
                  ROUND {roundNo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team) => (
              <tr key={team.teamNumber}>
                <td className="border-b border-white/5 p-1.5">
                  {MEDALS[team.place] ?? team.place}
                </td>
                <td className="border-b border-white/5 p-1.5">#{String(team.teamNumber).padStart(2, '0')}</td>
                <td className="border-b border-white/5 p-1.5">
                  {team.players.map(cleanName).join(' / ')}
                </td>
                <td className="border-b border-white/5 p-1.5 text-right">{team.totalKills}</td>
                <td className="border-b border-white/5 p-1.5 text-right font-bold">{team.totalScore}</td>
                {rounds.map((roundNo) => {
                  const round = team.rounds.find((r) => r.roundNo === roundNo);
                  return (
                    <Fragment key={roundNo}>
                      <td className="border-b border-white/5 p-1.5 text-right">
                        {round?.teamRank ?? '-'}
                      </td>
                      <td className="border-b border-white/5 p-1.5 text-right">
                        {round?.kills ?? '-'}
                      </td>
                      <td className="border-b border-white/5 p-1.5 text-right">
                        {round?.cumulativeTotal ?? '-'}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
