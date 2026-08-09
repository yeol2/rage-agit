'use client';

import { useState } from 'react';
import {
  fetchMatchParticipants,
  fetchSessionMatches,
  formatDistance,
  formatSurvival,
  sortByTeamRank,
  type ScrimMatch,
  type ScrimParticipant,
  type ScrimSessionSummary,
} from '@/lib/scrimData';

// 조회 함수는 기본값으로 두고 테스트에서만 바꿔 끼운다.
//
// 프롭으로 받게만 두면 부모(서버 컴포넌트)가 함수를 넘겨야 하는데,
// 서버에서 클라이언트로 함수는 건너가지 못한다("Functions cannot be passed
// directly to Client Components"). 기본값으로 두면 서버는 아무것도 안 넘기고
// 이 컴포넌트가 브라우저에서 직접 가져온다.
interface Props {
  session: ScrimSessionSummary;
  loadMatches?: (sessionId: string) => Promise<ScrimMatch[]>;
  loadParticipants?: (pubgMatchId: string) => Promise<ScrimParticipant[]>;
}

const KST_OFFSET_MS = 9 * 3600 * 1000;

function toKstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function ScrimSessionRow({
  session,
  loadMatches = fetchSessionMatches,
  loadParticipants = fetchMatchParticipants,
}: Props) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<ScrimMatch[] | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, ScrimParticipant[]>>({});
  const [participantError, setParticipantError] = useState<string | null>(null);

  async function toggleSession() {
    const next = !open;
    setOpen(next);
    if (!next || matches || matchError) return;

    try {
      setMatches(await loadMatches(session.id));
    } catch (error) {
      setMatchError((error as Error).message || '불러오지 못했습니다');
    }
  }

  async function toggleMatch(pubgMatchId: string) {
    const next = openMatchId === pubgMatchId ? null : pubgMatchId;
    setOpenMatchId(next);
    if (!next || participants[pubgMatchId]) return;

    try {
      const rows = await loadParticipants(pubgMatchId);
      setParticipants((prev) => ({ ...prev, [pubgMatchId]: rows }));
    } catch (error) {
      setParticipantError((error as Error).message || '불러오지 못했습니다');
    }
  }

  return (
    <li className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <button
          type="button"
          onClick={toggleSession}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <span aria-hidden="true" className="text-accent">
            {open ? '▾' : '▸'}
          </span>
          <span>
            <span className="block font-bold text-foreground">{session.title}</span>
            <span className="mt-1 block text-sm text-menu">
              {session.participantCount}명 참여 · {session.matchCount}경기
            </span>
          </span>
        </button>

        {session.replayUrl ? (
          <a
            href={session.replayUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md border border-accent/50 px-4 py-2 text-center text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-background"
          >
            다시보기
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-center text-sm text-white/25"
          >
            준비중
          </span>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-2 border-l border-white/10 pl-4">
          {matchError && <p className="text-sm text-red-400">{matchError}</p>}
          {!matchError && matches === null && <p className="text-sm text-menu">불러오는 중…</p>}
          {matches?.length === 0 && <p className="text-sm text-menu">경기가 없습니다.</p>}

          {matches?.map((match, index) => (
            <div key={match.pubgMatchId}>
              <button
                type="button"
                onClick={() => toggleMatch(match.pubgMatchId)}
                aria-expanded={openMatchId === match.pubgMatchId}
                className="flex w-full items-center gap-3 py-2 text-left text-sm"
              >
                <span aria-hidden="true" className="text-accent">
                  {openMatchId === match.pubgMatchId ? '▾' : '▸'}
                </span>
                <span className="font-bold">{index + 1}경기</span>
                <span className="text-menu">{toKstTime(match.playedAt)}</span>
                <span className="text-menu">{match.mapName ?? '-'}</span>
                <span className="text-menu">{match.participantCount}명</span>
              </button>

              {openMatchId === match.pubgMatchId && (
                <div className="overflow-x-auto pb-3">
                  {participantError && <p className="text-sm text-red-400">{participantError}</p>}
                  {!participantError && !participants[match.pubgMatchId] && (
                    <p className="text-sm text-menu">불러오는 중…</p>
                  )}
                  {participants[match.pubgMatchId] && (
                    <table className="w-full min-w-[42rem] text-left text-sm">
                      <thead className="text-menu">
                        <tr>
                          <th className="py-1 pr-3 font-normal">순위</th>
                          <th className="py-1 pr-3 font-normal">팀</th>
                          <th className="py-1 pr-3 font-normal">닉네임</th>
                          <th className="py-1 pr-3 font-normal">킬</th>
                          <th className="py-1 pr-3 font-normal">어시</th>
                          <th className="py-1 pr-3 font-normal">딜량</th>
                          <th className="py-1 pr-3 font-normal">DBNO</th>
                          <th className="py-1 pr-3 font-normal">헤드</th>
                          <th className="py-1 pr-3 font-normal">생존</th>
                          <th className="py-1 font-normal">이동</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortByTeamRank(participants[match.pubgMatchId]).map((p) => (
                          <tr key={p.pubgIgn} className="border-t border-white/[0.06]">
                            <td className="py-1 pr-3">{p.teamRank}</td>
                            <td className="py-1 pr-3 text-menu">{p.teamId}</td>
                            <td className="py-1 pr-3">
                              <span className="font-bold">{p.pubgIgn}</span>
                              {p.discordNickname && (
                                <span className="ml-2 text-xs text-menu">{p.discordNickname}</span>
                              )}
                            </td>
                            <td className="py-1 pr-3">{p.kills}</td>
                            <td className="py-1 pr-3">{p.assists}</td>
                            <td className="py-1 pr-3">{Math.round(p.damageDealt)}</td>
                            <td className="py-1 pr-3">{p.dbnos}</td>
                            <td className="py-1 pr-3">{p.headshotKills}</td>
                            <td className="py-1 pr-3">{formatSurvival(p.timeSurvived)}</td>
                            <td className="py-1">{formatDistance(p.distance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
