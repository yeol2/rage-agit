'use client';

import { useEffect, useRef, useState } from 'react';
import { LowTierTag } from '@/components/LowTierTag';
import { useScrimLive } from '@/lib/useScrimLive';
import { RoundSheetTable, TABLE_WIDTH, cleanName, type RoundSheetResponse } from '@/components/team-builder/RoundSheetTable';

// 씨앗 1명 고정 방식(team_number=1, tier_slot=1)이라 분당 10회 제한에 여유가
// 크다(측정 스크립트와 같은 간격 — scripts/measure-match-availability.mjs 참고).
// 최대 시도 횟수는 "포기하고 나중에 수동으로 다시 누르라"는 안전판일 뿐, 보통은
// 몇 번 안에 끝난다(실측: 매치 종료 2분 뒤엔 이미 조회 가능했다).
const AUTO_POLL_INTERVAL_MS = 7000;
const AUTO_POLL_MAX_ATTEMPTS = 60; // 7초 * 60 = 7분

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 중단 버튼이 다음 시도까지(최대 7초) 안 기다리고 바로 반응하도록, 짧은
// 간격으로 나눠 자면서 매번 cancelRef를 확인한다.
async function interruptibleSleep(ms: number, cancelRef: { current: boolean }) {
  const stepMs = 200;
  for (let waited = 0; waited < ms; waited += stepMs) {
    if (cancelRef.current) return;
    await sleep(Math.min(stepMs, ms - waited));
  }
}

export function RoundSheet({
  rosterId,
  initialLowTier = false,
}: {
  /**
   * 폴링 씨앗을 고르고 등수 스냅샷을 한 번만 찍기 위해 서버가 쓰는 값 —
   * 시트 내용과는 무관하다(시트는 날짜만으로 만들어진다). 명단을 아직 안
   * 올렸거나 "초기화"로 지운 뒤에는 없을 수 있고, 그때는 폴링 버튼만 잠긴다.
   */
  rosterId?: string;
  /** 명단에 저장돼 있던 저티어 내전 토글 값. 새로고침해도 이어지게 한다. */
  initialLowTier?: boolean;
}) {
  const [data, setData] = useState<RoundSheetResponse | null>(null);
  // 저티어 내전 토글 — "우승 확정"을 누르는 순간 이 값으로 트로피가 갈린다
  // (켜짐: 꽃게들의 왕, 꺼짐: 내전우승). 기본은 꺼짐.
  const [lowTier, setLowTier] = useState(initialLowTier);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // state 는 리렌더돼야 최신값을 읽으므로, 반복문 안에서 "중단해야 하는지"를
  // 즉시 확인하려면 ref 로 따로 들고 있어야 한다.
  const cancelRef = useRef(false);

  // 날짜를 안 넘기면 서버가 가장 최근 내전을 골라준다. 02에서 팀을 다시 짜도
  // 이 시트는 영향을 안 받는다 — 계획이 아니라 실제 매치만 보기 때문이다.
  async function loadSheet() {
    try {
      const response = await fetch('/api/scrim-roster/round-sheet', { cache: 'no-store' });
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
  }, []);

  // 라운드가 하나 들어오거나 우승이 확정되면 누가 폴링했든 모두의 화면이 따라간다.
  useScrimLive(() => void loadSheet());

  // 누른 시각과 몇 번째 시도인지는 여기서만 안다 — 한 번 눌러두면 매치가
  // 잡힐 때까지 알아서 두드리므로, 서버는 매 요청을 따로 본다. 디스코드
  // 알림이 "버튼 누르고 몇 초 만에 들어왔는지"를 적으려면 이 값이 필요하다.
  async function pollOnce(pressedAt: string, attempt: number): Promise<boolean> {
    const response = await fetch('/api/scrim-roster/round-sheet/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rosterId, pressedAt, attempt }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? '폴링에 실패했습니다.');
    return Boolean(body.found);
  }

  // 한 번 눌러두면 새 경기가 잡힐 때까지(또는 중단/시간 초과할 때까지) 알아서
  // 계속 두드린다 — 매번 손으로 다시 누를 필요가 없다.
  async function handlePoll() {
    cancelRef.current = false;
    setPolling(true);
    setPollMessage(null);
    const pressedAt = new Date().toISOString();

    for (let attempt = 1; attempt <= AUTO_POLL_MAX_ATTEMPTS; attempt++) {
      if (cancelRef.current) {
        setPollMessage('중단했습니다.');
        break;
      }
      setPollAttempt(attempt);

      try {
        const found = await pollOnce(pressedAt, attempt);
        if (found) {
          await loadSheet();
          setPollMessage(`폴링 성공 (${attempt}번째 시도)`);
          break;
        }
      } catch (err) {
        setPollMessage(err instanceof Error ? err.message : '폴링에 실패했습니다.');
        break;
      }

      if (attempt === AUTO_POLL_MAX_ATTEMPTS) {
        setPollMessage('시간 초과 — 새 경기를 찾지 못했습니다. 나중에 다시 눌러주세요.');
        break;
      }
      await interruptibleSleep(AUTO_POLL_INTERVAL_MS, cancelRef);
    }

    setPolling(false);
  }

  function handleCancelPoll() {
    cancelRef.current = true;
  }

  // 낙관적으로 먼저 바꾼다. 명단이 있으면 거기 저장해 새로고침해도 유지되게
  // 하고, 저장이 실패하면 되돌린다. 명단이 없으면 화면에서만 들고 있는다 —
  // 어느 쪽이든 확정 때는 지금 화면의 값을 그대로 보낸다.
  async function handleToggleLowTier() {
    const next = !lowTier;
    setLowTier(next);
    if (!rosterId) return;
    try {
      const response = await fetch('/api/scrim-roster/low-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rosterId, lowTier: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '저티어 내전 설정을 저장하지 못했습니다.');
    } catch (err) {
      setLowTier(!next);
      setPollMessage(err instanceof Error ? err.message : '저티어 내전 설정을 저장하지 못했습니다.');
    }
  }

  // 우승팀은 서버가 시트를 다시 만들어 정한다 — 여기서는 방아쇠만 당긴다.
  // 어떤 트로피를 줄지는 누르는 순간의 토글 값으로 정한다.
  async function handleConfirmWin() {
    setConfirming(true);
    setPollMessage(null);
    try {
      const response = await fetch('/api/scrim-roster/round-sheet/confirm-win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scrimDate: data?.scrimDate, lowTier, rosterId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '우승 확정에 실패했습니다.');
      // 저장되는 건 우승팀만이 아니라 1~16위 전부다(0028) — 몇 팀·몇 명이
      // 들어갔는지 같이 보여줘야 매칭이 덜 된 채로 확정한 걸 알아챌 수 있다.
      setPollMessage(
        `${body.lowTier ? '꽃게들의 왕' : '내전우승'} 확정 — ${body.players.map(cleanName).join(' / ')} (${body.totalScore}점)` +
          ` · 종합등수 ${body.savedTeams}팀 ${body.savedMembers}명 저장`,
      );
    } catch (err) {
      setPollMessage(err instanceof Error ? err.message : '우승 확정에 실패했습니다.');
    } finally {
      setConfirming(false);
    }
  }

  if (loadError) return <p className="mt-4 text-sm text-red-400">{loadError}</p>;
  if (!data) return <p className="mt-4 text-sm text-menu">불러오는 중…</p>;


  const unstable = data.unstableTeamPlayers ?? [];

  return (
    <div>
      {unstable.length > 0 && (
        <p className="mb-4 rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          팀 번호가 라운드 중간에 바뀐 사람이 있습니다 ({unstable.map(cleanName).join(', ')}).
          시트는 1라운드 번호를 기준으로 그렸으니, 이 팀들의 점수는 확정 전에 한 번
          확인해주세요.
        </p>
      )}
      <RoundSheetTable data={data} />

      <div className="mt-4 flex items-center justify-between" style={{ width: TABLE_WIDTH, maxWidth: '100%' }}>
        {/* 준비 중에는 지난 내전이 보이므로 어느 날짜인지 반드시 같이 띄운다 —
            없으면 오늘 것으로 오해한다. */}
        <h3 className="hud flex items-center gap-2 text-xs text-menu">
          {data.scrimDate ? `${data.scrimDate} · ` : ''}경기 {data.roundCount}개 기록됨
          {lowTier && <LowTierTag />}
        </h3>
        <div className="flex items-center gap-2">
          {polling && (
            <button
              type="button"
              onClick={handleCancelPoll}
              className="rounded-md border border-white/15 px-3 py-2 text-xs text-menu hover:border-accent"
            >
              중단
            </button>
          )}
          {/* 저티어 내전 토글 — 켠 채로 "우승 확정"을 누르면 우승팀이 내전우승
              트로피 대신 "꽃게들의 왕"을 받는다. */}
          <label className="mr-2 inline-flex cursor-pointer select-none items-center gap-2.5">
            <span className={`text-sm transition-colors ${lowTier ? 'text-white' : 'text-menu'}`}>저티어 내전</span>
            <button
              type="button"
              role="switch"
              aria-checked={lowTier}
              aria-label="저티어 내전"
              onClick={() => void handleToggleLowTier()}
              className={`relative inline-flex h-4 w-9 shrink-0 items-center rounded-full transition-colors ${
                lowTier ? 'bg-accent/45' : 'bg-white/20'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute h-5 w-5 rounded-full border-[3px] transition-all ${
                  lowTier ? 'left-[calc(100%-1.25rem)] border-accent bg-accent' : 'left-0 border-[#6B6B70] bg-white'
                }`}
              />
            </button>
          </label>
          {/* 4경기가 다 기록돼야 내전우승이 정해진다 — 그 전에는 눌러도
              서버가 막지만, 버튼부터 잠가 헛클릭을 줄인다. */}
          <button
            type="button"
            onClick={() => void handleConfirmWin()}
            disabled={confirming || polling || data.roundCount < 4}
            title={data.roundCount < 4 ? '4경기가 다 기록돼야 확정할 수 있습니다' : undefined}
            className="rounded-md border border-white/15 px-3 py-2 text-xs text-menu hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15"
          >
            {confirming ? '확정 중…' : '우승 확정'}
          </button>
          <button
            type="button"
            onClick={() => void handlePoll()}
            // 폴링은 씨앗을 고르는 데 로스터가 필요하다(라운드 1은 아직 매치가
            // 없어 참가자를 알 길이 없다). 명단이 없으면 누를 수 없다.
            disabled={polling || !rosterId}
            title={!rosterId ? '명단을 먼저 업로드해야 폴링할 수 있습니다' : undefined}
            className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {polling ? `폴링 중… (${pollAttempt}번째 시도)` : '폴링'}
          </button>
        </div>
      </div>
      {pollMessage && <p className="mt-2 text-xs text-menu">{pollMessage}</p>}
    </div>
  );
}
