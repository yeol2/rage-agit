'use client';

import { useState, type DragEvent, type FormEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import {
  sortEntriesByTier,
  moveEntryToSlot,
  groupEntriesByTier,
  type Roster,
  type RosterEntry,
} from '@/lib/scrimRoster';
import {
  ALL_TIERS,
  cleanDisplayName,
  stripTrailingKoreanTag,
  tierNameplateSelectedStyle,
  tierNameplateStyle,
} from '@/lib/memberStats';
import { VipCrown } from '@/components/VipCrown';

const TIER_SLOT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '1티어 (0~1.5)',
  2: '2티어 (2~2.5)',
  3: '3티어 (3~3.5)',
  4: '4티어 (4~5)',
};

const TIER_SLOTS = [1, 2, 3, 4] as const;

// 원래는 티어당 16명 고정이었는데, 업로드되는 명단이 60명·68명처럼 매번 달라져서
// "참가 인원 ÷ 4"로 목표치를 유동적으로 잡는다. 딱 안 나눠떨어지면 반올림한다.
function targetPerTierFor(totalCount: number): number {
  return totalCount > 0 ? Math.round(totalCount / 4) : 16;
}

// dragOverSlot 은 "지금 무엇 위에서 드래그 중인가"를 가리킨다 — 티어 칸(1~4),
// 미매칭 박스('unassigned'), 또는 아무 데도 아님(null).
type DropTarget = 1 | 2 | 3 | 4 | 'unassigned';

// 괄호 태그·이모지·부계정 표기·뒤에 붙은 한글 장식을 뗀 "Ez_XXXX" 형태만 보여준다 —
// 클랜원 페이지(MemberDirectory)와 같은 정리 규칙을 그대로 쓴다.
function displayName(entry: RosterEntry): string {
  if (!entry.discordNickname) return '(닉네임 정보 없음)';
  return stripTrailingKoreanTag(cleanDisplayName(entry.discordNickname));
}

// 클랜원 페이지와 같은 티어 색 네임플레이트. 색은 tier 값만 있으면 입힌다(수동으로
// 추가한 사람도 티어를 직접 입력받으므로 색이 있다) — 프로필 링크는 실제로 매칭된
// member_id 가 있을 때만 건다. 티어 칸 ↔ 미매칭 박스 사이는 둘 다 드래그로 옮길 수 있다.
//
// dragging 중인 카드는 tierNameplateSelectedStyle(원래 클릭 "선택함" 용으로 남겨둔
// 진한 배색)을 재사용해 "지금 집어든 카드"라는 걸 보여준다.
function Nameplate({
  entry,
  dragging = false,
  draggable = true,
  selected = false,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  entry: RosterEntry;
  dragging?: boolean;
  // 02 팀 구성 테이블은 아직 드래그로 옮기는 기능이 없다 — 01에서 쓰던 드래그
  // 핸들러를 그대로 붙이면 02의 카드를 01 쪽으로 끌어다 tierSlot 을 바꿔버릴
  // 수 있어(팀 번호는 갱신 안 된 채로) false 로 꺼둔다.
  draggable?: boolean;
  // 02 표에서 스왑 대상으로 클릭해 골라둔 카드 — tierNameplateSelectedStyle을
  // dragging과 같은 방식으로 재사용해 진하게 보여준다.
  selected?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}) {
  const name = displayName(entry);
  const hasTier = entry.tier !== null;
  const canLinkToProfile = entry.matched && entry.memberId;

  // 기본 드래그 고스트 이미지는 브라우저가 이 카드를 그대로 캡처하는데, hover 확대
  // 효과·블러·그라데이션이 섞인 채로 캡처되면 빠르게 움직일 때 지저분해 보인다.
  // 대신 이름만 적힌 작은 판을 만들어 고스트로 쓰고, 드래그 중엔 hover 확대도 끈다.
  function handleDragStart(event: DragEvent<HTMLElement>) {
    const ghost = document.createElement('div');
    ghost.textContent = name;
    ghost.style.cssText =
      'position:absolute; top:-1000px; left:-1000px; padding:6px 12px; background:#1a1622; color:#fff; border-radius:6px; font-size:12px; border:1px solid rgba(255,255,255,0.3); white-space:nowrap;';
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
    onDragStart?.(event);
  }

  // Link 로 렌더링된 카드는 기본 동작이 프로필 페이지 이동이다 — 02 표에서는
  // 클릭이 스왑 선택이어야 하므로 onClick이 있으면 이동을 막는다.
  function handleClick(event: MouseEvent<HTMLElement>) {
    if (!onClick) return;
    event.preventDefault();
    onClick();
  }

  const sharedClassName = `block truncate rounded-md border px-3 py-2 text-xs transition-transform ${
    draggable ? 'cursor-grab active:cursor-grabbing' : ''
  } ${onClick ? 'cursor-pointer' : ''} ${dragging ? 'opacity-40' : 'hover:scale-[1.03]'} ${
    selected ? 'ring-2 ring-accent' : ''
  }`;

  const style = hasTier
    ? dragging || selected
      ? tierNameplateSelectedStyle(entry.tier as number)
      : tierNameplateStyle(entry.tier as number)
    : undefined;

  let plate;
  if (!hasTier) {
    plate = (
      <div
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        onClick={handleClick}
        className={`${sharedClassName} border-white/10 text-menu`}
      >
        {name}
      </div>
    );
  } else if (canLinkToProfile) {
    plate = (
      <Link
        href={`/members/${entry.memberId}`}
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        onClick={handleClick}
        className={sharedClassName}
        style={style}
      >
        {name}
      </Link>
    );
  } else {
    plate = (
      <div
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        onClick={handleClick}
        className={sharedClassName}
        style={style}
      >
        {name}
      </div>
    );
  }

  // 왕관은 클랜원 명단과 같은 규칙으로 VIP 에게만 — 카드 자체가 아니라 감싼 상자에
  // 붙여서, 드래그 중 카드가 반투명해져도 왕관은 또렷하게 남는다.
  return (
    <div className="relative">
      {plate}
      {entry.vipRank !== null && <VipCrown />}
    </div>
  );
}

interface LastMove {
  entryId: string;
  fromSlot: 1 | 2 | 3 | 4 | null;
}

export function RosterBoard({ roster }: { roster: Roster | null }) {
  const [entries, setEntries] = useState<RosterEntry[]>(roster?.entries ?? []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newTier, setNewTier] = useState<number>(ALL_TIERS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // "02 팀 구성 테이블"은 01(티어 테이블)이 완전히 다 찼을 때만 넘어갈 수 있다 —
  // 한 번 넘어간 뒤 01 쪽 인원을 다시 옮겨서 조건이 깨져도 이미 시작한 팀 구성을
  // 되돌리진 않는다(showTeamTable은 버튼을 누른 뒤로는 계속 true로 둔다).
  const [showTeamTable, setShowTeamTable] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [vipSorting, setVipSorting] = useState(false);
  const [vipSortError, setVipSortError] = useState<string | null>(null);

  if (!roster) {
    return <p className="mt-10 text-menu">아직 업로드된 명단이 없습니다. 파일을 업로드하세요.</p>;
  }

  // roster.id를 별도 변수로 빼둔다 — TS가 중첩 함수(handleAddManualEntry) 안에서는
  // 위의 null 체크로 좁혀진 roster 타입을 그대로 안 믿어준다.
  const rosterId = roster.id;

  // 낙관적으로 먼저 옮겨서 보여주고, 저장이 실패하면 원래대로 되돌린다.
  // recordUndo=false 로 부르면(되돌리기 버튼 자체가 이걸 쓴다) 되돌리기 기록을 새로
  // 안 남긴다 — 안 그러면 되돌리기를 누른 동작 자체가 또 되돌릴 수 있는 기록이 되어
  // "되돌리기의 되돌리기"가 끝없이 쌓인다.
  async function moveEntry(entryId: string, targetSlot: 1 | 2 | 3 | 4 | null, recordUndo: boolean) {
    const moving = entries.find((entry) => entry.id === entryId);
    if (!moving || moving.tierSlot === targetSlot) return;

    const previous = entries;
    setEntries(moveEntryToSlot(entries, entryId, targetSlot));
    setError(null);
    if (recordUndo) setLastMove({ entryId, fromSlot: moving.tierSlot });

    try {
      const response = await fetch(`/api/scrim-roster/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierSlot: targetSlot }),
      });
      if (!response.ok) throw new Error('저장 실패');
    } catch {
      setEntries(previous);
      setError('티어 칸 변경을 저장하지 못했습니다. 다시 시도하세요.');
    }
  }

  async function handleDrop(targetSlot: 1 | 2 | 3 | 4 | null) {
    setDragOverTarget(null);
    const entryId = draggingId;
    setDraggingId(null);
    if (!entryId) return;
    await moveEntry(entryId, targetSlot, true);
  }

  async function handleUndo() {
    if (!lastMove) return;
    const { entryId, fromSlot } = lastMove;
    setLastMove(null);
    await moveEntry(entryId, fromSlot, false);
  }

  // "팀 구성" 버튼 — 서버가 01 표시 순서 그대로 팀 번호를 계산해 저장하고,
  // 갱신된 전체 명단을 돌려준다. 그 응답으로 로컬 상태를 갈아끼우면 별도
  // 재조회 없이 02 표를 바로 채울 수 있다.
  async function handleAssignTeams() {
    setAssigning(true);
    setAssignError(null);

    try {
      const response = await fetch('/api/scrim-roster/team-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '팀 구성에 실패했습니다.');

      setEntries(body.entries as RosterEntry[]);
      setShowTeamTable(true);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : '팀 구성에 실패했습니다.');
    } finally {
      setAssigning(false);
    }
  }

  // 02 표에서 같은 티어 칼럼 안의 두 사람을 클릭으로 맞바꾼다. 낙관적으로 먼저
  // 화면을 바꾸고, 저장이 실패하면 되돌린다.
  async function handleSwapClick(entry: RosterEntry) {
    setSwapError(null);

    if (!selectedForSwap) {
      setSelectedForSwap(entry.id);
      return;
    }
    if (selectedForSwap === entry.id) {
      setSelectedForSwap(null);
      return;
    }

    const other = entries.find((e) => e.id === selectedForSwap);
    setSelectedForSwap(null);
    // 다른 티어 칼럼을 클릭한 경우 — 스왑 없이 새로 클릭한 칸을 선택 상태로 바꾼다.
    if (!other || other.tierSlot !== entry.tierSlot) {
      setSelectedForSwap(entry.id);
      return;
    }

    const previous = entries;
    setEntries((current) =>
      current.map((e) => {
        if (e.id === other.id) return { ...e, teamNumber: entry.teamNumber };
        if (e.id === entry.id) return { ...e, teamNumber: other.teamNumber };
        return e;
      }),
    );

    try {
      const response = await fetch('/api/scrim-roster/entries/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIdA: other.id, entryIdB: entry.id }),
      });
      if (!response.ok) throw new Error('저장 실패');
    } catch {
      setEntries(previous);
      setSwapError('팀 번호를 맞바꾸지 못했습니다. 다시 시도하세요.');
    }
  }

  // "VIP 정렬" 버튼 — 서버가 참가 중인 VIP를 등수 순으로 스왑해 저장하고, 갱신된
  // 전체 명단을 돌려준다.
  async function handleVipSort() {
    setVipSorting(true);
    setVipSortError(null);

    try {
      const response = await fetch('/api/scrim-roster/vip-sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'VIP 정렬에 실패했습니다.');

      setEntries(body.entries as RosterEntry[]);
    } catch (err) {
      setVipSortError(err instanceof Error ? err.message : 'VIP 정렬에 실패했습니다.');
    } finally {
      setVipSorting(false);
    }
  }

  function clearDragState() {
    // 드랍존 밖에서 놓거나 Esc로 취소해도(dragleave/drop 없이 dragend만 옴) 하이라이트가
    // 안 꺼진 채 남지 않도록 dragend에서 항상 같이 정리한다.
    setDraggingId(null);
    setDragOverTarget(null);
  }

  // 자동 매칭이 못 알아본 사람을 관리자가 직접 넣는다 — 티어 칸은 아직 안 정하고
  // 일단 미매칭에 넣어둔 뒤, 나중에 드래그로 원하는 티어 칸에 옮긴다.
  async function handleAddManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nickname = newNickname.trim();
    if (!nickname) {
      setAddError('닉네임을 입력하세요.');
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      const response = await fetch('/api/scrim-roster/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId, discordNickname: nickname, tier: newTier }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '추가에 실패했습니다.');

      setEntries((prev) => [...prev, body.entry as RosterEntry]);
      setNewNickname('');
      setNewTier(ALL_TIERS[0]);
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  const unassigned = sortEntriesByTier(entries.filter((entry) => entry.tierSlot === null));
  const targetPerTier = targetPerTierFor(entries.length);
  const allTiersFull = TIER_SLOTS.every(
    (slot) => entries.filter((entry) => entry.tierSlot === slot).length === targetPerTier,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="hud text-xs text-menu">
          마지막 갱신: {new Date(roster.fetchedAt).toLocaleString('ko-KR')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleUndo()}
            disabled={!lastMove}
            title="되돌리기"
            aria-label="되돌리기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            title="추가"
            aria-label="추가"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-base leading-none text-white hover:border-accent"
          >
            {showAddForm ? '✕' : '+'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddManualEntry} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newNickname}
            onChange={(event) => setNewNickname(event.target.value)}
            placeholder="닉네임"
            className="w-40 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          />
          <select
            value={newTier}
            onChange={(event) => setNewTier(Number(event.target.value))}
            className="rounded-md border border-white/15 bg-white/[0.03] px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          >
            {ALL_TIERS.map((tier) => (
              <option key={tier} value={tier} className="bg-background text-foreground">
                {tier}티어
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-background disabled:opacity-50"
          >
            확인
          </button>
          {addError && <p className="w-full text-xs text-red-400">{addError}</p>}
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_SLOTS.map((slot) => {
          const slotEntries = sortEntriesByTier(entries.filter((entry) => entry.tierSlot === slot));
          return (
            <section
              key={slot}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverTarget(slot);
              }}
              onDragLeave={() => setDragOverTarget((current) => (current === slot ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(slot);
              }}
              className={`relative rounded-lg border bg-white/[0.03] p-4 transition-colors ${
                dragOverTarget === slot
                  ? 'border-accent shadow-[0_0_24px_rgba(255,146,51,0.55)]'
                  : 'border-white/10'
              }`}
            >
              <div className={dragOverTarget === slot ? 'pointer-events-none blur-[2px]' : undefined}>
                <h3 className="hud text-xs text-white">
                  {TIER_SLOT_LABELS[slot]} — {slotEntries.length}/{targetPerTier}명
                </h3>
                {/* 칸 안에 실제 티어(예: 2, 2.5)가 섞여 있어서, 인원이 있는 티어만 구분선과
                    함께 보여준다 — 다 옮겨가서 0명이 되면 그 구분선은 자동으로 사라진다. */}
                {groupEntriesByTier(slotEntries).map((group) => (
                  <div key={group.tier ?? 'unknown'} className="mt-3">
                    <div className="flex items-center gap-2">
                      <span className="hud text-[10px] text-menu">
                        {group.tier === null ? '미확인' : `${group.tier}티어`}
                      </span>
                      <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
                    </div>
                    <ul className="mt-2 grid grid-cols-2 gap-2">
                      {group.entries.map((entry) => (
                        <li key={entry.id}>
                          <Nameplate
                            entry={entry}
                            dragging={entry.id === draggingId}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              setDraggingId(entry.id);
                            }}
                            onDragEnd={clearDragState}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {dragOverTarget === slot && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white/70">+</span>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragOverTarget('unassigned');
        }}
        onDragLeave={() => setDragOverTarget((current) => (current === 'unassigned' ? null : current))}
        onDrop={(event) => {
          event.preventDefault();
          void handleDrop(null);
        }}
        className={`relative mt-8 rounded-lg border p-4 transition-colors ${
          dragOverTarget === 'unassigned'
            ? 'border-accent shadow-[0_0_24px_rgba(255,146,51,0.55)]'
            : 'border-white/10'
        }`}
      >
        <div className={dragOverTarget === 'unassigned' ? 'pointer-events-none blur-[2px]' : undefined}>
          <h3 className="hud text-xs text-menu">보류 ({unassigned.length})</h3>

          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {unassigned.map((entry) => (
              <li key={entry.id}>
                <Nameplate
                  entry={entry}
                  dragging={entry.id === draggingId}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggingId(entry.id);
                  }}
                  onDragEnd={clearDragState}
                />
              </li>
            ))}
          </ul>
        </div>
        {dragOverTarget === 'unassigned' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white/70">+</span>
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-col items-end gap-2">
        {assignError && <p className="text-sm text-red-400">{assignError}</p>}
        <button
          type="button"
          onClick={() => void handleAssignTeams()}
          disabled={!allTiersFull || assigning}
          title={allTiersFull ? '팀 구성' : `1~4티어가 모두 ${targetPerTier}명씩 차야 팀 구성을 시작할 수 있습니다`}
          className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-transparent disabled:text-menu disabled:opacity-40"
        >
          {assigning ? '배정 중…' : '팀 구성'}
        </button>
      </div>

      {showTeamTable && (
        <div className="mt-10 border-t border-white/10 pt-10">
          <h2 className="text-2xl font-bold tracking-tight">
            <span style={{ color: '#322F36' }}>02</span> 팀 구성 테이블
          </h2>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex-1 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-white/10 p-2 text-left text-xs text-menu">팀</th>
                    {TIER_SLOTS.map((slot) => (
                      <th key={slot} className="border-b border-white/10 p-2 text-left text-xs text-menu">
                        {slot}티어
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: targetPerTier }, (_, i) => i + 1).map((teamNumber) => (
                    <tr key={teamNumber} className="border-b border-white/5">
                      <td className="p-2 text-xs text-menu">{teamNumber}번팀</td>
                      {TIER_SLOTS.map((slot) => {
                        const member = entries.find(
                          (entry) => entry.tierSlot === slot && entry.teamNumber === teamNumber,
                        );
                        return (
                          <td key={slot} className="p-2">
                            {member ? (
                              <Nameplate
                                entry={member}
                                draggable={false}
                                selected={selectedForSwap === member.id}
                                onClick={() => void handleSwapClick(member)}
                              />
                            ) : (
                              <div className="h-9 w-full rounded-md border border-dashed border-white/10" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {swapError && <p className="mt-2 text-sm text-red-400">{swapError}</p>}
            </div>

            <div className="flex flex-row gap-2 lg:w-40 lg:flex-col">
              <button
                type="button"
                onClick={() => void handleVipSort()}
                disabled={vipSorting}
                className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold text-white hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {vipSorting ? '정렬 중…' : 'VIP 정렬'}
              </button>
              {vipSortError && <p className="text-xs text-red-400">{vipSortError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
