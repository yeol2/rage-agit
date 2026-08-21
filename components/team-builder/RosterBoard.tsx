'use client';

import { useState, type DragEvent, type FormEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  fixedNameplateStyle,
  stripTrailingKoreanTag,
  tierNameplateSelectedStyle,
  tierNameplateStyle,
} from '@/lib/memberStats';
import { VipCrown } from '@/components/VipCrown';
import { RoundSheet } from '@/components/team-builder/RoundSheet';
import { NAMEPLATE_HEIGHT, NAMEPLATE_WIDTH } from '@/lib/teamBuilderLayout';

const TIER_SLOT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '1티어 (0~1.5)',
  2: '2티어 (2~2.5)',
  3: '3티어 (3~3.5)',
  4: '4티어 (4~5)',
};

const TIER_SLOTS = [1, 2, 3, 4] as const;

// 오른쪽 버튼 세로줄(VIP 정렬/리롤)은 네임플레이트 크기의 1.5배로 비율을 맞춘다.
const SIDE_BUTTON_WIDTH = NAMEPLATE_WIDTH * 1.5;
const SIDE_BUTTON_HEIGHT = NAMEPLATE_HEIGHT * 1.5;
const SIDE_BUTTON_CLASS =
  'flex items-center justify-center truncate rounded-md border border-white/15 px-2 text-[21px] font-bold text-white hover:border-accent disabled:cursor-not-allowed disabled:opacity-40';

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
  fixed = false,
  width,
  onDragStart,
  onDragEnd,
  onClick,
  onDelete,
}: {
  entry: RosterEntry;
  dragging?: boolean;
  // 02 표에서는 fixed 인 카드만 false 로 넘어온다(고정된 자리는 드래그로 못
  // 옮긴다) — 01은 항상 true.
  draggable?: boolean;
  // entry.fixed 를 그대로 읽지 않고 호출하는 쪽이 명시적으로 넘긴다 — 고정은
  // 02(팀 구성 테이블) 개념이라, 같은 entry가 01 티어 칸에도 그려질 때는 고정
  // 여부와 무관하게 항상 false로 둬야 01 쪽 카드가 같이 어두워지지 않는다.
  fixed?: boolean;
  // 02 표의 <table> 칸은 auto-layout이라 내용에 따라 칸 너비가 제멋대로
  // 정해진다 — 01의 실측 너비(px)를 그대로 박아서 두 표의 카드 폭을 맞춘다.
  width?: number;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
  // 01/보류 카드에만 넘긴다 — 02(팀 구성 테이블)는 계산된 결과라 개별 삭제가
  // 없다.
  onDelete?: () => void;
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

  const sharedClassName = `block truncate rounded-md border px-3 py-2 text-sm transition-transform ${
    draggable ? 'cursor-grab active:cursor-grabbing' : ''
  } ${onClick ? 'cursor-pointer' : ''} ${dragging ? 'opacity-40' : 'hover:scale-[1.03]'}`;

  // 고정된 카드는 티어 색과 무관하게 색감을 죽인 회색조로 표시한다(참고 이미지의
  // 비활성 탭처럼) — fixed인 카드는 애초에 드래그가 안 되니 dragging과 겹칠 일이
  // 없다.
  const tierStyle = hasTier
    ? fixed
      ? fixedNameplateStyle()
      : dragging
        ? tierNameplateSelectedStyle(entry.tier as number)
        : tierNameplateStyle(entry.tier as number)
    : undefined;
  const style = width !== undefined ? { ...tierStyle, width } : tierStyle;

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
  // 고정 여부는 배지가 아니라 카드 자체를 회색조로 죽여서(fixedNameplateStyle)
  // 나타낸다.
  return (
    <div className="relative">
      {plate}
      {entry.vipRank !== null && <VipCrown />}
      {onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`${name} 삭제`}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-base leading-none text-white/70 hover:text-red-400"
        >
          ×
        </button>
      )}
    </div>
  );
}

interface LastMove {
  entryId: string;
  fromSlot: 1 | 2 | 3 | 4 | null;
}

export function RosterBoard({ roster }: { roster: Roster | null }) {
  const router = useRouter();
  const [entries, setEntries] = useState<RosterEntry[]>(roster?.entries ?? []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 드래그로 티어 칸을 옮길 때마다 쌓인다 — "되돌리기"를 여러 번 누르면 하나씩
  // 거슬러 올라간다(리롤 되돌리기와 같은 방식).
  const [moveHistory, setMoveHistory] = useState<LastMove[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newTier, setNewTier] = useState<number>(ALL_TIERS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 01/02/03 진행 상태 — roster.stage(DB)로 초기화해서 새로고침해도 유지된다.
  // 한 번 넘어간 뒤 01 쪽 인원을 다시 옮겨서 조건이 깨져도 이미 시작한 팀 구성을
  // 되돌리진 않는다(단방향 진행).
  const [stage, setStage] = useState<'01' | '02' | '03'>(roster?.stage ?? '01');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [enteringRoundSheet, setEnteringRoundSheet] = useState(false);
  const [enterRoundSheetError, setEnterRoundSheetError] = useState<string | null>(null);
  const [draggingSwapId, setDraggingSwapId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [vipSorting, setVipSorting] = useState(false);
  const [vipSortError, setVipSortError] = useState<string | null>(null);
  const [rerollingKey, setRerollingKey] = useState<string | null>(null);
  const [rerollError, setRerollError] = useState<string | null>(null);
  // 리롤 버튼을 누르기 직전마다 그때의 team_number 스냅샷을 쌓아둔다 — "되돌리기"를
  // 누르면 가장 최근 스냅샷과 지금 상태를 비교해 바뀐 자리만 복원한다(Ctrl+Z처럼
  // 여러 번 눌러 여러 단계를 거슬러 올라갈 수 있다).
  const [rerollHistory, setRerollHistory] = useState<Array<Map<string, number | null>>>([]);
  const [undoingReroll, setUndoingReroll] = useState(false);

  // "초기화" 버튼 — 실수로 누르면 이번 내전 전체 계획(01/02/03)이 날아가므로
  // 바로 실행하지 않고, 경고 문구가 딸린 확인 버튼을 한 번 더 눌러야 진행된다.
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
    if (recordUndo) {
      setMoveHistory((history) => [...history, { entryId, fromSlot: moving.tierSlot }]);
    }

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
    if (moveHistory.length === 0) return;
    const { entryId, fromSlot } = moveHistory[moveHistory.length - 1];
    setMoveHistory((history) => history.slice(0, -1));
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
      setStage(body.stage as '01' | '02' | '03');
      // 새로 배정된 팀 번호 기준으로 다시 시작 — 이전 배정을 향한 리롤 되돌리기
      // 스냅샷은 더 이상 의미가 없다.
      setRerollHistory([]);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : '팀 구성에 실패했습니다.');
    } finally {
      setAssigning(false);
    }
  }

  // "내전 드가자~" 버튼 — 02→03 전환. 01→02와 달리 조건 없이 언제든 누를 수
  // 있다.
  async function handleEnterRoundSheet() {
    setEnteringRoundSheet(true);
    setEnterRoundSheetError(null);

    try {
      const response = await fetch(`/api/scrim-roster/${rosterId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: '03' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '내전 시트를 열지 못했습니다.');

      setStage(body.stage as '01' | '02' | '03');
    } catch (err) {
      setEnterRoundSheetError(err instanceof Error ? err.message : '내전 시트를 열지 못했습니다.');
    } finally {
      setEnteringRoundSheet(false);
    }
  }

  // "초기화" 버튼 — 이번 내전(01/02/03) 전체를 지우고 01 명단 업로드 이전
  // 상태로 되돌린다. 성공하면 서버 컴포넌트를 다시 불러 roster=null 화면으로
  // 돌아간다(fetchLatestRoster가 더 이상 아무 행도 못 찾으므로).
  async function handleReset() {
    setResetting(true);
    setResetError(null);

    try {
      const response = await fetch('/api/scrim-roster/reset', { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '초기화에 실패했습니다.');

      setResetConfirming(false);
      router.refresh();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : '초기화에 실패했습니다.');
    } finally {
      setResetting(false);
    }
  }

  // 02 표에서 같은 티어 칼럼 안의 두 사람을 드래그로 맞바꾼다(01과 같은 방식).
  // 낙관적으로 먼저 화면을 바꾸고, 저장이 실패하면 되돌린다. 대상이 없거나,
  // 둘 중 하나라도 고정돼 있거나, 티어 칼럼이 다르면 조용히 아무 일도 안
  // 일어난다(방어적 — 화면에서 이미 draggable/드롭 조건으로 대부분 막아둔다).
  async function handleSwapDrop(targetEntry: RosterEntry | undefined) {
    const sourceId = draggingSwapId;
    setDraggingSwapId(null);
    if (!targetEntry || !sourceId || sourceId === targetEntry.id || targetEntry.fixed) return;

    const source = entries.find((e) => e.id === sourceId);
    if (!source || source.fixed || source.tierSlot !== targetEntry.tierSlot) return;

    setSwapError(null);
    const previous = entries;
    setEntries((current) =>
      current.map((e) => {
        if (e.id === source.id) return { ...e, teamNumber: targetEntry.teamNumber };
        if (e.id === targetEntry.id) return { ...e, teamNumber: source.teamNumber };
        return e;
      }),
    );

    try {
      const response = await fetch('/api/scrim-roster/entries/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIdA: source.id, entryIdB: targetEntry.id }),
      });
      if (!response.ok) throw new Error('저장 실패');
    } catch {
      setEntries(previous);
      setSwapError('팀 번호를 맞바꾸지 못했습니다. 다시 시도하세요.');
    }
  }

  // 02 표 네임플레이트를 클릭하면 그 사람 하나만 고정을 토글한다(특정 티어
  // 한 자리만 고정하고 싶을 때 쓴다 — 팀 전체를 고정하려면 "고정" 칼럼을 쓴다).
  async function handleToggleFixed(entry: RosterEntry) {
    const nextFixed = !entry.fixed;
    setSwapError(null);
    const previous = entries;
    setEntries((current) => current.map((e) => (e.id === entry.id ? { ...e, fixed: nextFixed } : e)));

    try {
      const response = await fetch(`/api/scrim-roster/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixed: nextFixed }),
      });
      if (!response.ok) throw new Error('저장 실패');
    } catch {
      setEntries(previous);
      setSwapError('고정 상태를 저장하지 못했습니다. 다시 시도하세요.');
    }
  }

  // 01 티어 칸/보류 카드의 X 버튼 — 확인 없이 즉시 지운다. 실패하면 목록을
  // 원래대로 되돌린다.
  async function handleDeleteEntry(entryId: string) {
    setDeleteError(null);
    const previous = entries;
    setEntries((current) => current.filter((entry) => entry.id !== entryId));

    try {
      const response = await fetch(`/api/scrim-roster/entries/${entryId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('삭제 실패');
    } catch {
      setEntries(previous);
      setDeleteError('삭제하지 못했습니다. 다시 시도하세요.');
    }
  }

  // "고정" 칼럼 — 그 팀 4명 중 하나라도 고정 안 돼 있으면 전부 고정으로,
  // 4명 다 고정돼 있으면 전부 해제로 맞춘다.
  async function handleTeamFixToggle(teamNumber: number) {
    const teamEntries = entries.filter((e) => e.teamNumber === teamNumber && e.tierSlot !== null);
    const nextFixed = !teamEntries.every((e) => e.fixed);

    setSwapError(null);
    const previous = entries;
    setEntries((current) =>
      current.map((e) => (e.teamNumber === teamNumber && e.tierSlot !== null ? { ...e, fixed: nextFixed } : e)),
    );

    try {
      const response = await fetch('/api/scrim-roster/entries/team-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId, teamNumber, fixed: nextFixed }),
      });
      if (!response.ok) throw new Error('저장 실패');
    } catch {
      setEntries(previous);
      setSwapError('팀 고정을 저장하지 못했습니다. 다시 시도하세요.');
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

  // "전체 리롤" / "N티어 리롤" 버튼 — tier 생략 시 1~4 티어 각각 독립적으로,
  // 지정 시 그 티어만 고정 안 된 사람끼리 무작위로 재배치한다.
  async function handleReroll(tier?: 1 | 2 | 3 | 4) {
    const key = tier === undefined ? 'all' : String(tier);
    setRerollingKey(key);
    setRerollError(null);
    const snapshot = new Map(entries.map((entry) => [entry.id, entry.teamNumber]));

    try {
      const response = await fetch('/api/scrim-roster/reroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tier === undefined ? { rosterId } : { rosterId, tier }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '리롤에 실패했습니다.');

      setEntries(body.entries as RosterEntry[]);
      setRerollHistory((history) => [...history, snapshot]);
    } catch (err) {
      setRerollError(err instanceof Error ? err.message : '리롤에 실패했습니다.');
    } finally {
      setRerollingKey(null);
    }
  }

  // 리롤 "되돌리기" — 가장 최근 리롤 스냅샷을 꺼내 지금 상태와 비교해, 그 리롤로
  // 바뀐 자리만 원래 team_number로 되돌린다. 여러 번 누르면 스냅샷을 하나씩 더
  // 거슬러 올라간다.
  async function handleUndoReroll() {
    if (rerollHistory.length === 0) return;
    const snapshot = rerollHistory[rerollHistory.length - 1];
    setRerollHistory((history) => history.slice(0, -1));
    setUndoingReroll(true);
    setRerollError(null);

    const changes: Array<{ id: string; teamNumber: number }> = [];
    for (const entry of entries) {
      const previousTeamNumber = snapshot.get(entry.id);
      if (
        previousTeamNumber !== undefined &&
        previousTeamNumber !== null &&
        previousTeamNumber !== entry.teamNumber
      ) {
        changes.push({ id: entry.id, teamNumber: previousTeamNumber });
      }
    }

    const previousEntries = entries;
    setEntries((current) =>
      current.map((entry) => {
        const previousTeamNumber = snapshot.get(entry.id);
        return previousTeamNumber !== undefined && previousTeamNumber !== null
          ? { ...entry, teamNumber: previousTeamNumber }
          : entry;
      }),
    );

    try {
      const response = await fetch('/api/scrim-roster/reroll/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId, changes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '되돌리기에 실패했습니다.');

      setEntries(body.entries as RosterEntry[]);
    } catch (err) {
      setEntries(previousEntries);
      setRerollHistory((history) => [...history, snapshot]);
      setRerollError(err instanceof Error ? err.message : '되돌리기에 실패했습니다.');
    } finally {
      setUndoingReroll(false);
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
            disabled={moveHistory.length === 0}
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              className={`relative rounded-lg border bg-white/[0.03] p-3 transition-colors ${
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
                    <ul className="mt-2 grid grid-cols-2 gap-1">
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
                            onDelete={() => void handleDeleteEntry(entry.id)}
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
          {deleteError && <p className="mt-2 text-xs text-red-400">{deleteError}</p>}

          <ul className="mt-3 flex flex-wrap gap-2">
            {unassigned.map((entry) => (
              <li key={entry.id}>
                <Nameplate
                  entry={entry}
                  dragging={entry.id === draggingId}
                  width={NAMEPLATE_WIDTH}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggingId(entry.id);
                  }}
                  onDragEnd={clearDragState}
                  onDelete={() => void handleDeleteEntry(entry.id)}
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

      {stage !== '01' && (
        <div className="mt-10 border-t border-white/10 pt-10">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            <span className="mr-3" style={{ color: '#322F36' }}>02</span> 팀 구성 테이블
          </h2>

          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-white/10 py-1.5 pl-1.5 pr-4 text-left text-xs text-menu">팀</th>
                    {TIER_SLOTS.map((slot) => (
                      <th key={slot} className="border-b border-white/10 p-1.5 text-left text-xs text-menu">
                        {slot}티어
                      </th>
                    ))}
                    <th className="border-b border-white/10 p-1.5 text-center text-xs text-menu">고정</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: targetPerTier }, (_, i) => i + 1).map((teamNumber) => {
                    const teamEntries = entries.filter(
                      (entry) => entry.teamNumber === teamNumber && entry.tierSlot !== null,
                    );
                    const teamAllFixed = teamEntries.length > 0 && teamEntries.every((entry) => entry.fixed);

                    return (
                      <tr key={teamNumber} className="border-b border-white/5">
                        <td className="py-1.5 pl-1.5 pr-4 text-xs text-white">{teamNumber}</td>
                        {TIER_SLOTS.map((slot) => {
                          const member = entries.find(
                            (entry) => entry.tierSlot === slot && entry.teamNumber === teamNumber,
                          );
                          return (
                            <td
                              key={slot}
                              className="p-1.5"
                              onDragOver={(event) => {
                                if (draggingSwapId) event.preventDefault();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                void handleSwapDrop(member);
                              }}
                            >
                              {member ? (
                                <Nameplate
                                  entry={member}
                                  draggable={!member.fixed}
                                  fixed={member.fixed}
                                  // 01 티어 칸의 실측 너비(px) — 표 auto-layout이
                                  // 내용에 따라 칸 너비를 제멋대로 정해서 그냥 두면
                                  // 01/02 카드 폭이 달라진다.
                                  width={NAMEPLATE_WIDTH}
                                  dragging={member.id === draggingSwapId}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDraggingSwapId(member.id);
                                  }}
                                  onDragEnd={() => setDraggingSwapId(null)}
                                  onClick={() => void handleToggleFixed(member)}
                                />
                              ) : (
                                <div
                                  style={{ width: NAMEPLATE_WIDTH, height: NAMEPLATE_HEIGHT }}
                                  className="rounded-md border border-dashed border-white/10"
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => void handleTeamFixToggle(teamNumber)}
                            aria-label={`${teamNumber}번팀 고정`}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm ${
                              teamAllFixed
                                ? 'border-accent bg-accent/20 text-accent'
                                : 'border-white/15 text-menu hover:border-accent'
                            }`}
                          >
                            📌
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {swapError && <p className="mt-2 text-sm text-red-400">{swapError}</p>}
            </div>

            <div className="flex flex-row gap-3 lg:w-44 lg:flex-col">
              <button
                type="button"
                onClick={() => void handleVipSort()}
                disabled={vipSorting}
                style={{ width: SIDE_BUTTON_WIDTH, height: SIDE_BUTTON_HEIGHT }}
                className={SIDE_BUTTON_CLASS}
              >
                {vipSorting ? '정렬 중…' : 'VIP 정렬'}
              </button>
              {vipSortError && <p className="text-xs text-red-400">{vipSortError}</p>}
              <button
                type="button"
                onClick={() => void handleReroll()}
                disabled={rerollingKey !== null || undoingReroll}
                style={{ width: SIDE_BUTTON_WIDTH, height: SIDE_BUTTON_HEIGHT }}
                className={SIDE_BUTTON_CLASS}
              >
                {rerollingKey === 'all' ? '리롤 중…' : '전체 리롤'}
              </button>
              {([1, 2, 3, 4] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => void handleReroll(tier)}
                  disabled={rerollingKey !== null || undoingReroll}
                  style={{ width: SIDE_BUTTON_WIDTH, height: SIDE_BUTTON_HEIGHT }}
                  className={SIDE_BUTTON_CLASS}
                >
                  {rerollingKey === String(tier) ? '리롤 중…' : `${tier}티어 리롤`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void handleUndoReroll()}
                disabled={rerollHistory.length === 0 || rerollingKey !== null || undoingReroll}
                style={{ width: SIDE_BUTTON_WIDTH, height: SIDE_BUTTON_HEIGHT }}
                className={SIDE_BUTTON_CLASS}
              >
                {undoingReroll ? '되돌리는 중…' : '리롤 되돌리기'}
              </button>
              {rerollError && <p className="text-xs text-red-400">{rerollError}</p>}

              {/* 16번팀(마지막 행)과 같은 높이에 오도록, 위 버튼들과는 별개로
                  이 칸 맨 아래에 붙인다 — 부모 행이 items-stretch 라 이 칸의
                  높이가 표와 같아져서 mt-auto 가 표 맨 아래 행 위치까지 밀어준다. */}
              <div className="mt-auto flex flex-col items-end gap-2">
                {enterRoundSheetError && <p className="text-xs text-red-400">{enterRoundSheetError}</p>}
                <button
                  type="button"
                  onClick={() => void handleEnterRoundSheet()}
                  disabled={stage === '03' || enteringRoundSheet}
                  title={stage === '03' ? '이미 내전 시트가 열려 있습니다' : '자 드가자'}
                  className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-transparent disabled:text-menu disabled:opacity-40"
                >
                  {enteringRoundSheet ? '여는 중…' : '자 드가자'}
                </button>
              </div>
            </div>
          </div>

          {stage === '03' && (
            <div className="mt-10 border-t border-white/10 pt-10">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                <span className="mr-3" style={{ color: '#322F36' }}>03</span> 내전 시트
              </h2>
              <div className="mt-10">
                <RoundSheet rosterId={rosterId} />
              </div>

              <div aria-hidden="true" className="mt-16 border-t border-white/10" />

              <div className="mt-10 flex flex-col items-center gap-3">
                {!resetConfirming ? (
                  <button
                    type="button"
                    onClick={() => setResetConfirming(true)}
                    className="rounded-md border border-red-500 bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                  >
                    전체 초기화
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 px-6 py-4 text-center">
                    <p className="text-sm font-bold text-red-300">
                      정말 초기화할까요? 01/02/03 전체 진행 상태가 지워지고 되돌릴 수 없습니다.
                    </p>
                    <p className="text-xs text-red-300/80">
                      (실제 PUBG 경기 기록·리더보드 데이터는 지워지지 않습니다)
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setResetConfirming(false)}
                        disabled={resetting}
                        className="rounded-md border border-white/15 px-4 py-2 text-sm text-menu hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReset()}
                        disabled={resetting}
                        className="rounded-md border border-red-500 bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {resetting ? '초기화 중…' : '네, 초기화합니다'}
                      </button>
                    </div>
                  </div>
                )}
                {resetError && <p className="text-sm text-red-400">{resetError}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
