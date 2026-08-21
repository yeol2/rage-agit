'use client';

import { useState } from 'react';
import {
  fetchMatchParticipants,
  fetchSessionMatches,
  formatDistance,
  formatSurvival,
  groupParticipantsByTeam,
  sortByTeamRank,
  type ScrimMatch,
  type ScrimParticipant,
  type ScrimSessionSummary,
} from '@/lib/scrimData';
import { mapLabel } from '@/lib/mapNames';

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

// 매치 상세: 팀 하나를 박스 하나로 묶어서 보여준다 — 앞으로 이 페이지에
// "내전 인원"을 보여줄 땐 항상 이 규칙(팀별 박스 + 등수순 정렬)을 따른다.
// 순위/팀은 팀당 한 번(박스 헤더)만 적으면 되므로, 안쪽 그리드에는 넣지
// 않는다(4명 내내 같은 값이 반복되던 걸 없앴다).
const TEAM_PLAYER_GRID =
  'grid grid-cols-[1fr_2.5rem_2.5rem_3.5rem_3.5rem_2.5rem_3.5rem_3.5rem] items-center gap-x-2';

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
                {/* dak.gg 출처는 날짜까지만 안다. 자리표시자 시각을 보여주면
                    사실인 것처럼 읽힌다. */}
                {match.source !== 'dakgg' && (
                  <span className="text-menu">{toKstTime(match.playedAt)}</span>
                )}
                <span className="text-menu">{mapLabel(match.mapName)}</span>
                <span className="text-menu">{match.participantCount}명</span>
              </button>

              {openMatchId === match.pubgMatchId && (
                <div className="overflow-x-auto pb-3">
                  {participantError && <p className="text-sm text-red-400">{participantError}</p>}
                  {!participantError && !participants[match.pubgMatchId] && (
                    <p className="text-sm text-menu">불러오는 중…</p>
                  )}
                  {participants[match.pubgMatchId] && (
                    <div className="min-w-[36rem] space-y-2">
                      <div className={`${TEAM_PLAYER_GRID} px-3 text-xs text-menu`}>
                        <span>닉네임</span>
                        <span>킬</span>
                        <span>어시</span>
                        <span>딜량</span>
                        <span>DBNO</span>
                        <span>헤드</span>
                        <span>생존</span>
                        <span>이동</span>
                      </div>

                      {groupParticipantsByTeam(sortByTeamRank(participants[match.pubgMatchId])).map(
                        (team) => (
                          <div
                            key={team.teamId}
                            className="overflow-hidden rounded-lg border border-white/10"
                          >
                            <div className="flex items-center gap-2 bg-white/[0.04] px-3 py-1.5 text-xs">
                              <span className="font-bold text-foreground">{team.teamRank}위</span>
                              <span className="text-menu">팀 {team.teamId}</span>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                              {team.players.map((p) => (
                                <div key={p.pubgIgn} className={`${TEAM_PLAYER_GRID} px-3 py-1.5 text-sm`}>
                                  <span>
                                    <span className="font-bold">{p.pubgIgn}</span>
                                    {p.discordNickname && (
                                      <span className="ml-2 text-xs text-menu">{p.discordNickname}</span>
                                    )}
                                  </span>
                                  <span>{p.kills}</span>
                                  <span>{p.assists}</span>
                                  <span>{Math.round(p.damageDealt)}</span>
                                  <span>{p.dbnos}</span>
                                  <span>{p.headshotKills}</span>
                                  <span>{formatSurvival(p.timeSurvived)}</span>
                                  <span>{formatDistance(p.distance)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
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
