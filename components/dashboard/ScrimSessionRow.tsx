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
import { medalRank } from '@/lib/memberDashboard';

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

// 한 경기 안에서 1~3위 팀만 금·은·동으로 칠한다. 은·동은 리더보드 트로피 배지
// (TierRankingPodium 의 TROPHY_COLORS)와 같은 #CDCDCD · #B38A48 이고, 금만
// 리더보드의 #FFD365 보다 밝고 노란 #FFE04D 다 — 동색(#B38A48)이 황갈색이라
// 금이 조금만 어두워도 둘이 같은 색으로 읽힌다. 칩·테두리·헤더 모두 같은 값을
// 쓴다(밝기만 알파로 달리한다).
//
// 리더보드는 배지를 그 색으로 꽉 채우지만 여기는 얇은 테두리와 한 줄짜리
// 헤더뿐이라, 같은 색도 옅게 깔면 금과 동이 같은 황갈색으로 뭉갠다. 그래서
// 등수 글자만 색을 꽉 채워(어두운 글씨 + 메달색 배경) 리더보드 배지처럼
// 보여주고, 테두리·헤더는 그 색의 옅은 톤으로 받친다.
const MEDAL_TEAM_BORDER: Record<1 | 2 | 3, string> = {
  1: 'border-[rgba(255,224,77,0.7)]',
  2: 'border-[rgba(205,205,205,0.5)]',
  3: 'border-[rgba(179,138,72,0.6)]',
};

const MEDAL_TEAM_HEADER: Record<1 | 2 | 3, string> = {
  1: 'bg-[linear-gradient(180deg,rgba(255,224,77,0.2),rgba(255,224,77,0.04))]',
  2: 'bg-[linear-gradient(180deg,rgba(205,205,205,0.14),rgba(205,205,205,0.03))]',
  3: 'bg-[linear-gradient(180deg,rgba(179,138,72,0.16),rgba(179,138,72,0.03))]',
};

// 등수 글자 자리. 글자색은 리더보드 배지의 트로피 글리프 색 그대로다.
const MEDAL_TEAM_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-[#FFE04D] text-[#5A4413]',
  2: 'bg-[#CDCDCD] text-[#44464A]',
  3: 'bg-[#B38A48] text-[#3F2D11]',
};

// 펼침 표시. 접힌 상태가 ˅ 고 펼치면 돌아간다 — 두 글자(▸/▾)를 갈아 끼우면
// 바뀌는 순간만 눈에 띄는데, 돌아가면 "이게 여닫는 것"이라는 게 남는다.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      {/* 줄 전체가 버튼이다. 작은 ▸ 글자 하나만 있을 땐 눌러서 펼치는 줄인 줄
          모르는 사람이 많았다 — 호버하면 줄이 통째로 밝아지고, 오른쪽에
          "경기 보기 ˅" 라고 무슨 일이 일어나는지 적어둔다. */}
      <button
        type="button"
        onClick={toggleSession}
        aria-expanded={open}
        className="-mx-3 flex w-[calc(100%+1.5rem)] items-center justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span>
          <span className="block font-bold text-foreground">{session.title}</span>
          <span className="mt-1 block text-sm text-menu">
            {session.participantCount}명 참여 · {session.matchCount}경기
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-bold text-menu">
          {open ? '접기' : '경기 보기'}
          <Chevron open={open} />
        </span>
      </button>

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
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]"
              >
                <span className="text-accent">
                  <Chevron open={openMatchId === match.pubgMatchId} />
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
                        (team) => {
                          const medal = medalRank(team.teamRank);

                          return (
                            <div
                              key={team.teamId}
                              data-testid={`match-team-${team.teamId}`}
                              className={`overflow-hidden rounded-lg border ${
                                medal ? MEDAL_TEAM_BORDER[medal] : 'border-white/10'
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                                  medal ? MEDAL_TEAM_HEADER[medal] : 'bg-white/[0.04]'
                                }`}
                              >
                                <span
                                  className={`font-bold ${
                                    medal
                                      ? `rounded px-1.5 py-0.5 ${MEDAL_TEAM_BADGE[medal]}`
                                      : 'text-foreground'
                                  }`}
                                >
                                  {team.teamRank}위
                                </span>
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
                          );
                        },
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
