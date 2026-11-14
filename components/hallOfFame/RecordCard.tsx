'use client';

import { useState } from 'react';
import { TierBadge } from '@/components/TierBadge';
import { TrophySquare } from '@/components/TrophySquare';
import { MEDAL_BORDER, MEDAL_GRADIENT, medalOf } from '@/lib/medalStyles';
import type { RecordBoard, RecordPlayer } from '@/lib/hallOfFame';

function teamNames(players: RecordPlayer[]): string {
  return players.map((p) => p.name).join(' · ');
}

// 명예의 전당 카드 하나 — 기록 하나의 1~10등.
// 1~3등 줄은 내전 기록의 1~3위 팀 박스와 같은 금·은·동 테두리 + 그라데이션(lib/medalStyles),
// 등수 칸은 리더보드 시상대와 같은 금·은·동 트로피(TrophySquare)다(2026-11-15 사용자 요청).

function formatValue(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function RecordCard({ board }: { board: RecordBoard }) {
  // 티어 그룹 탭(내전 최다 킬). 처음엔 첫 탭(0~1.5). 그룹이 없는 기록은 entries 그대로.
  const [groupId, setGroupId] = useState(board.groups?.[0]?.id ?? null);
  const entries = board.groups?.find((g) => g.id === groupId)?.entries ?? board.entries;

  return (
    <section
      data-testid={`record-${board.id}`}
      className="rounded-2xl border border-white/[0.06] bg-[#1B1B23] p-3 sm:p-5"
    >
      {/* 카드 머리(제목·설명·티어 탭)만 가운데 정렬 — 아래 1~10등 줄은 그대로(2026-11-15). */}
      {/* 제목 강조 — 한 단계 크게(20px) + 아래 가운데 짧은 주황 밑줄(사이트 강조색). 2026-11-15. */}
      <h2 className="text-center text-xl font-bold tracking-tight text-foreground">{board.title}</h2>
      <span aria-hidden="true" className="mx-auto mt-2.5 block h-[3px] w-10 rounded-full bg-accent" />
      {/* 간격은 제목(밑줄까지)↔설명 : 설명↔등수(또는 탭) = 2 : 1 (20px : 10px, 2026-11-15 사용자 요청). */}
      <p className="mt-5 whitespace-pre-line text-center text-xs leading-relaxed text-menu">{board.description}</p>

      {board.groups && (
        // 리더보드 티어 탭과 같은 경계. 카드가 좁아 '티어' 글자는 빼고 숫자만 적는다.
        <div role="tablist" aria-label="티어 그룹" className="mt-2.5 flex flex-wrap justify-center gap-1 sm:gap-1.5">
          {board.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={group.id === groupId}
              onClick={() => setGroupId(group.id)}
              className={
                group.id === groupId
                  ? 'rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white sm:px-3'
                  : 'rounded-full px-2 py-1 text-xs text-menu transition-colors hover:text-foreground sm:px-3'
              }
            >
              {group.label.replace('티어', '')}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-menu">아직 기록이 없습니다.</p>
      ) : (
        <ol className="mt-2.5 space-y-1.5">
          {entries.map((entry, i) => {
            const medal = medalOf(entry.rank);
            return (
            <li
              key={`${entry.date}-${teamNames(entry.players)}-${i}`}
              className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2.5 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-3 ${
                medal ? `border ${MEDAL_BORDER[medal]} ${MEDAL_GRADIENT[medal]}` : 'border border-transparent'
              }`}
            >
              <span className="flex justify-center text-sm font-bold tabular-nums text-menu" aria-label={`${entry.rank}등`}>
                {medal ? <TrophySquare rank={medal} size="sm" /> : entry.rank}
              </span>
              <span className="min-w-0">
                {board.kind === 'player' ? (
                  // 개인 기록 — 이름 옆에 리더보드와 같은 티어 뱃지(지금 티어).
                  // 좁은 카드(휴대폰)에서 자리가 모자라면 이름을 자르지 않고 뱃지를 아래 줄로 내린다.
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-bold text-foreground">{entry.players[0]?.name}</span>
                    {entry.players[0]?.tier != null && (
                      <TierBadge tier={entry.players[0].tier} className="shrink-0" />
                    )}
                  </span>
                ) : (
                  // 팀 기록 — 팀원은 고티어 → 저티어 순(lib/hallOfFame 의 byTier).
                  // 한 줄에 안 들어가면 "…"로 잘려 둘만 보였다 — 카드가 세 장씩 놓이는
                  // 넓은 화면에서도 좁아서, 어느 폭이든 줄을 넘겨 넷 다 보여준다.
                  <span
                    className="block text-sm font-bold text-foreground"
                    title={teamNames(entry.players)}
                  >
                    {teamNames(entry.players)}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] tabular-nums text-subtext">
                  {entry.date}
                  {entry.map && <span className="ml-1.5 text-menu">{entry.map}</span>}
                  {entry.detail && <span className="ml-1.5">· {entry.detail}</span>}
                </span>
              </span>
              {entry.valueLabel ? (
                // 줄 세운 값과 보여줄 값이 다른 기록 — 딜딸러의 '1킬 990딜'.
                <span className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-foreground">
                  {entry.valueLabel}
                </span>
              ) : (
                <span className="text-right text-base font-bold tabular-nums text-foreground">
                  {formatValue(entry.value)}
                  <span className="ml-0.5 text-[11px] font-bold text-menu">{board.unit}</span>
                </span>
              )}
            </li>
            );
          })}
        </ol>
      )}

      <p className="mt-3 text-right text-[10px] text-subtext">{board.since}부터 기록</p>
    </section>
  );
}
