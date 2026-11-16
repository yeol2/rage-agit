'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FAKE_WAIT_MIN_MS,
  FAKE_SHOW_MS,
  MAX_RECORD_MS,
  MIN_HUMAN_MS,
  REACTION_ROUNDS,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
  average,
  planFakeRounds,
  suspiciousReason,
  type ReactionRankEntry,
} from '@/lib/reaction';

// 반응속도 테스트 한 판.
//   idle → (START) → waiting(빨강) ─(가끔 fake 노랑 잠깐)→ go(초록) → round(이번 기록) → … → done
//   빨강에서 누르면 early(그 회차만 다시), 노랑에서 누르면 faked(쌓은 기록 버리고 1회차부터).
// 모든 상태는 이 컴포넌트 안에만 있다(서버·다른 사용자와 공유 안 함).

type Phase = 'idle' | 'waiting' | 'fake' | 'go' | 'round' | 'early' | 'faked' | 'done';

const NICKNAME_KEY = 'rage-reaction-nickname';

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function verdict(avg: number): string {
  if (avg < 200) return '에임봇 의심됨. 관리자 호출할까요?';
  if (avg < 240) return '총소리 나기 전에 쏘는 사람';
  if (avg < 280) return '평균 이상. 교전에서 먼저 쏩니다';
  if (avg < 330) return '평범한 사람의 반응속도예요';
  if (avg < 400) return '맞고 나서 돌아보는 타입';
  return '혹시 지금 밥 먹으면서 하세요?';
}

const ARENA_STYLE: Record<Phase, string> = {
  idle: 'bg-[#1B1B23] border-white/[0.06]',
  waiting: 'bg-[#B4232A] border-[#E0484F]/40',
  fake: 'bg-[#F5C518] border-[#FFE36B]/60',
  go: 'bg-[#2FBF63] border-[#6EF09A]/60',
  round: 'bg-[#1B1B23] border-white/[0.06]',
  early: 'bg-[#1B1B23] border-[#E0484F]/50',
  faked: 'bg-[#1B1B23] border-[#F5C518]/50',
  done: 'bg-[#1B1B23] border-white/[0.06]',
};

const HOW_TO = [
  { color: 'bg-[#B4232A]', title: '빨간불', body: '기다리세요. 언제 바뀔지는 매번 달라요.' },
  { color: 'bg-[#2FBF63]', title: '초록불', body: '바로 클릭! (스페이스바도 됩니다)' },
  { color: 'bg-[#F5C518]', title: '노란불', body: '함정이에요. 누르면 처음부터 다시!' },
];

const RULES = [
  `${REACTION_ROUNDS}회 성공하면 끝! 순위는 ${REACTION_ROUNDS}회 평균이 빠른 순이에요.`,
  '빨간불에서 미리 누르면 그 회차만 다시, 노란불을 누르면 1회차부터 다시 해요.',
  '노란불은 한 판에 적어도 한 번은 나와요. 연속으로 나올 수도 있어요.',
  '랭킹 등록은 클랜원만 — PUBG 닉네임과 클랜 코드가 필요해요. 한 사람당 최고 기록 하나만 남아요.',
  'AI·매크로를 이용한 부정을 막는 툴이 적용돼 있어요.',
];

interface RegisterResult {
  improved: boolean;
  previousBestMs: number | null;
  rank: number | null;
}

export function ReactionGame({
  onRegistered,
}: {
  onRegistered: (ranking: ReactionRankEntry[], memberId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [runToken, setRunToken] = useState<string | null>(null);

  const timers = useRef<number[]>([]);
  const goAt = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const timesRef = useRef<number[]>([]);
  const fakePlan = useRef<boolean[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const startRound = useCallback(() => {
    clearTimers();
    changePhase('waiting');
    // 이번 회차가 노란불 회차인지는 판 시작 때 정해둔 계획대로(빨간불에서 미리 눌러 다시 해도 그대로).
    const fake = fakePlan.current[timesRef.current.length] ?? false;
    const wait = randomBetween(fake ? FAKE_WAIT_MIN_MS : WAIT_MIN_MS, WAIT_MAX_MS);

    // 페이크 노란불 — 초록불보다 충분히 앞에, 잠깐만 켠다.
    if (fake) {
      const fakeAt = randomBetween(700, wait - FAKE_SHOW_MS - 500);
      timers.current.push(window.setTimeout(() => changePhase('fake'), fakeAt));
      timers.current.push(window.setTimeout(() => changePhase('waiting'), fakeAt + FAKE_SHOW_MS));
    }

    timers.current.push(
      window.setTimeout(() => {
        goAt.current = performance.now();
        changePhase('go');
      }, wait),
    );
  }, []);

  const startGame = () => {
    // 서버의 시작 도장(①) — 등록할 때 같이 보낸다. 받는 동안에도 게임은 바로 시작한다.
    setRunToken(null);
    fetch('/api/reaction/start', { method: 'POST' })
      .then((response) => response.json())
      .then((data) => setRunToken(typeof data.token === 'string' ? data.token : null))
      .catch(() => setRunToken(null));
    fakePlan.current = planFakeRounds();
    timesRef.current = [];
    setTimes([]);
    setLastMs(null);
    setMistakes(0);
    startRound();
  };

  // 경기장 클릭(또는 스페이스). 마우스를 "뗄 때"가 아니라 "누를 때" 잰다.
  const hit = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'waiting' || current === 'fake') {
      clearTimers();
      setMistakes((n) => n + 1);
      if (current === 'fake') {
        // 노란불에 낚이면 지금까지 쌓은 회차를 전부 버린다(2026-11-16 사용자 요청).
        // 새 판이니 노란불 계획도 새로 짠다.
        timesRef.current = [];
        setTimes([]);
        fakePlan.current = planFakeRounds();
      }
      changePhase(current === 'fake' ? 'faked' : 'early');
      return;
    }
    if (current === 'go') {
      const ms = Math.round(performance.now() - goAt.current);
      if (ms < MIN_HUMAN_MS) {
        // 초록불 0.1초 안의 클릭은 본 게 아니라 찍은 것.
        setMistakes((n) => n + 1);
        changePhase('early');
        return;
      }
      const next = [...timesRef.current, ms];
      timesRef.current = next;
      setLastMs(ms);
      setTimes(next);
      changePhase(next.length >= REACTION_ROUNDS ? 'done' : 'round');
      return;
    }
    if (current === 'round' || current === 'early' || current === 'faked') startRound();
  }, [startRound]);

  const playing = phase !== 'idle' && phase !== 'done';

  useEffect(() => {
    if (!playing) return;
    const onKey = (event: KeyboardEvent) => {
      // isTrusted — 진짜 키보드 입력만(②). 스크립트로 만든 키 이벤트는 false 다.
      if (event.code !== 'Space' || event.repeat || !event.isTrusted) return;
      event.preventDefault();
      hit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, hit]);

  const roundNo = Math.min(times.length + 1, REACTION_ROUNDS);

  return (
    <div className="space-y-4">
      {/* 설명 — 무엇을 하면 되는지 */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {HOW_TO.map((step) => (
          <li key={step.title} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#16161D] px-4 py-3">
            <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-full ${step.color}`} />
            <span>
              <span className="block text-sm font-bold text-foreground">{step.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-menu">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 규칙 요약 — 세세한 기준(확률·검사 수치)은 일부러 안 적는다(2026-11-16 사용자 요청). */}
      <ul className="space-y-1.5 rounded-xl border border-white/[0.06] bg-[#16161D] px-4 py-3 text-xs leading-relaxed text-menu">
        {RULES.map((rule) => (
          <li key={rule} className="flex gap-2">
            <span aria-hidden="true" className="text-accent">·</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>

      <div
        role={playing ? 'button' : undefined}
        aria-label={playing ? '반응속도 테스트 화면 — 초록불에 누르세요' : undefined}
        data-phase={phase}
        onPointerDown={
          playing
            ? (event) => {
                event.preventDefault();
                // 진짜 마우스·터치만(②). 콘솔 스크립트로 만든 클릭(dispatchEvent)은 무시한다.
                if (event.nativeEvent.isTrusted) hit();
              }
            : undefined
        }
        className={`relative flex min-h-[380px] select-none flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center transition-colors duration-75 sm:min-h-[440px] ${ARENA_STYLE[phase]} ${
          playing ? 'cursor-pointer touch-manipulation' : ''
        }`}
      >
        {playing && (
          <div className="absolute left-0 right-0 top-5 flex justify-center gap-2" aria-label={`${roundNo} / ${REACTION_ROUNDS} 회차`}>
            {Array.from({ length: REACTION_ROUNDS }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i < times.length ? 'bg-white' : i === times.length ? 'bg-white/50' : 'bg-white/15'
                }`}
              />
            ))}
          </div>
        )}

        {phase === 'idle' && (
          <>
            <p className="hud text-xs text-accent">{REACTION_ROUNDS} ROUNDS</p>
            <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">초록불이 켜지면 클릭</p>
            <p className="mt-2 text-sm text-menu">빨간불에서 기다리고, 노란불에는 속지 마세요.</p>
            <button
              type="button"
              onClick={startGame}
              className="mt-8 rounded-xl bg-accent px-12 py-4 text-lg font-bold tracking-wide text-[#1A1206] transition-transform hover:scale-[1.03] active:scale-95"
            >
              START
            </button>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">기다리세요…</p>
            <p className="mt-3 text-sm text-white/70">초록불이 켜지면 클릭</p>
          </>
        )}

        {(phase === 'fake' || phase === 'go') && (
          <p className="text-5xl font-black tracking-tight text-[#0E0B13] sm:text-6xl">지금!</p>
        )}

        {phase === 'round' && lastMs !== null && (
          <>
            <p className="text-6xl font-black tabular-nums tracking-tight sm:text-7xl">
              {lastMs}
              <span className="ml-1 text-2xl font-bold text-menu">ms</span>
            </p>
            <p className="mt-4 text-sm text-menu">클릭해서 다음 회차 ({times.length + 1}/{REACTION_ROUNDS})</p>
          </>
        )}

        {phase === 'early' && (
          <>
            <p className="text-4xl font-bold tracking-tight text-[#FF6B70] sm:text-5xl">너무 빨라요!</p>
            <p className="mt-3 text-sm text-menu">초록불이 켜진 다음에 눌러야 해요. 클릭해서 이 회차 다시.</p>
          </>
        )}

        {phase === 'faked' && (
          <>
            <p className="text-4xl font-bold tracking-tight text-[#F5C518] sm:text-5xl">낚였다!</p>
            <p className="mt-3 text-sm text-menu">노란불은 페이크예요. 기록이 날아갔어요 — 클릭해서 1회차부터 다시.</p>
          </>
        )}

        {phase === 'done' && <Result times={times} mistakes={mistakes} runToken={runToken} onRetry={startGame} onRegistered={onRegistered} />}
      </div>
    </div>
  );
}

function Result({
  times,
  mistakes,
  runToken,
  onRetry,
  onRegistered,
}: {
  times: number[];
  mistakes: number;
  runToken: string | null;
  onRetry: () => void;
  onRegistered: (ranking: ReactionRankEntry[], memberId: string) => void;
}) {
  const avg = average(times);
  const best = Math.min(...times);
  const tooSlow = times.some((t) => t > MAX_RECORD_MS);
  const suspicious = tooSlow ? null : suspiciousReason(times);
  const rankable = !tooSlow && !suspicious;

  const [formOpen, setFormOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);

  useEffect(() => {
    try {
      setNickname(window.localStorage.getItem(NICKNAME_KEY) ?? '');
    } catch {}
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, code, times, token: runToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? '등록하지 못했습니다.');
        return;
      }
      try {
        window.localStorage.setItem(NICKNAME_KEY, nickname.trim());
      } catch {}
      setResult({ improved: data.improved, previousBestMs: data.previousBestMs, rank: data.rank });
      onRegistered(data.ranking, data.memberId);
    } catch {
      setError('네트워크 오류로 등록하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <p className="hud text-xs text-accent">RESULT · {REACTION_ROUNDS}회 평균</p>
      <p className="mt-2 text-7xl font-black tabular-nums tracking-tight">
        {avg}
        <span className="ml-1 text-2xl font-bold text-menu">ms</span>
      </p>
      <p className="mt-2 text-sm font-bold text-foreground">{verdict(avg)}</p>

      <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
        {times.map((t, i) => (
          <li
            key={i}
            className={`rounded-lg px-2.5 py-1 text-xs tabular-nums ${
              t === best ? 'bg-accent/15 font-bold text-accent' : 'bg-white/[0.06] text-menu'
            }`}
          >
            {t}ms
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-subtext">
        최고 {best}ms{mistakes > 0 ? ` · 실수 ${mistakes}번` : ''}
      </p>

      {result ? (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
          {result.improved ? (
            <p className="font-bold text-foreground">
              랭킹 {result.rank}등 등재!
              {result.previousBestMs !== null && (
                <span className="font-normal text-menu"> (이전 최고 {result.previousBestMs}ms)</span>
              )}
            </p>
          ) : (
            <p className="text-foreground">
              최고 기록 {result.previousBestMs}ms 보다 느려서 랭킹은 그대로예요. (지금 {result.rank}등)
            </p>
          )}
        </div>
      ) : formOpen ? (
        <form onSubmit={submit} className="mt-6 space-y-2 text-left">
          <label className="block">
            <span className="text-xs text-menu">PUBG 닉네임 (내전에 쓰는 본캐)</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="off"
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E0B13] px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-menu">클랜 코드 (클랜 국룰 비번)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E0B13] px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-xs text-[#FF6B70]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-bold text-[#1A1206] disabled:opacity-50"
            >
              {busy ? '확인 중…' : '등록하기'}
            </button>
            <button type="button" onClick={onRetry} className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm text-menu hover:text-foreground">
              다시 하기
            </button>
          </div>
        </form>
      ) : null}

      {!formOpen && !result && (
        <div className="mt-6 flex justify-center gap-2">
          {rankable && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-[#1A1206]"
            >
              랭킹 등록
            </button>
          )}
          <button type="button" onClick={onRetry} className="rounded-lg bg-white/[0.06] px-6 py-2.5 text-sm text-menu hover:text-foreground">
            다시 하기
          </button>
        </div>
      )}
      {tooSlow && <p className="mt-3 text-xs text-subtext">2초 넘게 걸린 회차가 있어서 랭킹에는 못 올려요.</p>}
      {suspicious && <p className="mt-3 text-xs text-[#FF6B70]">{suspicious}</p>}
      {result && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-white/[0.06] px-6 py-2.5 text-sm text-menu hover:text-foreground">
          다시 하기
        </button>
      )}
    </div>
  );
}
