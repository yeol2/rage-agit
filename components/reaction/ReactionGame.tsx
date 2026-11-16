'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  MAX_RECORD_MS,
  MIN_HUMAN_MS,
  REACTION_ROUNDS,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
  average,
  planFakeRounds,
  roundTimeline,
  suspiciousReason,
  verdict,
  COMMENT_MAX_CHARS,
  commentLength,
  type ReactionRankEntry,
} from '@/lib/reaction';
import { BgmControl } from './BgmControl';

// 반응속도 테스트 한 판.
//   idle → (START) → waiting(빨강) ─(가끔 fake 노랑 1~1.5초 → 빨강 1~4.3초, 이어서 반복 가능)→ go(초록) → round(이번 기록) → … → done
//   빨강에서 누르면 early, 노랑에서 누르면 faked — 둘 다 쌓은 기록 버리고 1회차부터(failRun).
// 모든 상태는 이 컴포넌트 안에만 있다(서버·다른 사용자와 공유 안 함).

// paused — 진행 중 다른 탭·창으로 나갔다 온 상태(그 회차만 다시, 실수로 안 센다).
type Phase = 'idle' | 'waiting' | 'fake' | 'go' | 'round' | 'early' | 'faked' | 'paused' | 'done';

const NICKNAME_KEY = 'rage-reaction-nickname';


function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}


const ARENA_STYLE: Record<Phase, string> = {
  idle: 'bg-[#1B1B23] border-white/[0.06]',
  waiting: 'bg-[#B4232A] border-[#E0484F]/40',
  fake: 'bg-[#F5C518] border-[#FFE36B]/60',
  go: 'bg-[#2FBF63] border-[#6EF09A]/60',
  round: 'bg-[#1B1B23] border-white/[0.06]',
  early: 'bg-[#1B1B23] border-[#E0484F]/50',
  faked: 'bg-[#1B1B23] border-[#F5C518]/50',
  paused: 'bg-[#1B1B23] border-white/[0.06]',
  done: 'bg-[#1B1B23] border-white/[0.06]',
};

const HOW_TO = [
  { color: 'bg-[#B4232A]', title: '빨간불', body: '기다리세요. 미리 누르면 처음부터 다시!' },
  { color: 'bg-[#2FBF63]', title: '초록불', body: '바로 클릭! (스페이스바도 됩니다)' },
  { color: 'bg-[#F5C518]', title: '노란불', body: '함정이에요. 누르면 처음부터 다시!' },
];

const RULES = [
  `${REACTION_ROUNDS}회 성공하면 끝! 순위는 ${REACTION_ROUNDS}회 평균이 빠른 순이에요.`,
  '빨간불·노란불에서 누르거나 초록불을 미리 찍으면(0.1초 안) 기록이 날아가고 1회차부터 다시 해요.',
  '빨간불은 매번 기다리는 시간이 달라요. 감으로 찍지 말고 초록불을 보고 누르세요.',
  '랭킹 등록은 클랜원만 — PUBG 닉네임과 내전 비밀번호(국룰)가 필요해요. 한 사람당 최고 기록 하나만 남아요.',
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
  const fakePlan = useRef<number[]>([]);
  const arenaWrap = useRef<HTMLDivElement>(null);
  const tokenRequest = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const startRound = useCallback(() => {
    clearTimers();
    changePhase('waiting');
    // 이번 회차의 노란불 개수는 판 시작 때 정해둔 계획대로(다른 화면에 나갔다 와서 다시 해도 그대로).
    // 노란불이 몇 번 나오는지는 화면 설명에 일부러 안 적는다 — 개수를 알면 다시 예측한다(2026-11-16).
    // 노랑 1~1.5초, 꺼지고 1~4.3초 뒤 다음 불(초록 또는 또 노랑) — lib/reaction 의 roundTimeline.
    const count = fakePlan.current[timesRef.current.length] ?? 0;
    const { fakes, goAt: greenAt } = roundTimeline(randomBetween(WAIT_MIN_MS, WAIT_MAX_MS), count);
    for (const { on, off } of fakes) {
      timers.current.push(window.setTimeout(() => changePhase('fake'), on));
      timers.current.push(window.setTimeout(() => changePhase('waiting'), off));
    }

    timers.current.push(
      window.setTimeout(() => {
        // 시계는 여기서가 아니라 초록이 실제로 그려지는 프레임에서 켠다(아래 useLayoutEffect).
        // 그 전에 들어온 클릭은 초록을 볼 수 없었으니 early 로 친다.
        goAt.current = 0;
        changePhase('go');
      }, greenAt),
    );
  }, []);

  // 실수 화면(너무 빨라요·낚였다)에서 START 화면으로 — 진행 중이던 판은 버린다(2026-11-16 사용자 요청).
  const goHome = () => {
    clearTimers();
    timesRef.current = [];
    setTimes([]);
    setLastMs(null);
    changePhase('idle');
  };

  // 경기장 클릭은 "이 회차 다시"라서, 버튼을 누른 건 그쪽으로 안 올린다(onPointerDown stopPropagation).
  const homeButton = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        goHome();
      }}
      // 경기장 아래쪽 가장자리 가까이(2026-11-16 사용자 요청 — 문구 바로 밑보다 더 낮게).
      className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-white/20 sm:bottom-8"
    >
      메인 페이지로
    </button>
  );

  const startGame = () => {
    // 시작하면 경기장이 화면 가운데 오게 스크롤한다.
    arenaWrap.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 서버의 시작 도장(①) — 등록할 때 같이 보낸다. 받는 동안에도 게임은 바로 시작한다.
    // 다시 하기를 빠르게 연달아 누르면 앞 판의 응답이 늦게 와서 새 토큰을 덮을 수 있다 — 마지막 요청만 받는다.
    setRunToken(null);
    const request = ++tokenRequest.current;
    fetch('/api/reaction/start', { method: 'POST' })
      .then((response) => response.json())
      .then((data) => {
        if (request === tokenRequest.current) setRunToken(typeof data.token === 'string' ? data.token : null);
      })
      .catch(() => {
        if (request === tokenRequest.current) setRunToken(null);
      });
    fakePlan.current = planFakeRounds();
    timesRef.current = [];
    setTimes([]);
    setLastMs(null);
    setMistakes(0);
    startRound();
  };

  // 경기장 클릭(또는 스페이스). 마우스를 "뗄 때"가 아니라 "누를 때" 잰다.
  // 실수(빨강·노랑에서 누름, 초록 0.1초 안에 누름)는 전부 쌓은 회차를 버리고 1회차부터 —
  // 노란불은 처음부터 그랬고, 빨간불도 같이(2026-11-16 사용자 요청). 그 회차만 다시 하게 두면
  // 초록이 뜰 법한 때 계속 찍어 보다가 운 좋게 걸린 기록을 낼 수 있었다. 새 판이니 노란불 계획도 새로.
  const failRun = useCallback((phase: 'early' | 'faked') => {
    clearTimers();
    setMistakes((n) => n + 1);
    timesRef.current = [];
    setTimes([]);
    fakePlan.current = planFakeRounds();
    changePhase(phase);
  }, []);

  const hit = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'waiting' || current === 'fake') {
      failRun(current === 'fake' ? 'faked' : 'early');
      return;
    }
    if (current === 'go') {
      const ms = goAt.current === 0 ? 0 : Math.round(performance.now() - goAt.current);
      if (ms < MIN_HUMAN_MS) {
        // 초록불 0.1초 안의 클릭은 본 게 아니라 찍은 것.
        failRun('early');
        return;
      }
      const next = [...timesRef.current, ms];
      timesRef.current = next;
      setLastMs(ms);
      setTimes(next);
      changePhase(next.length >= REACTION_ROUNDS ? 'done' : 'round');
      return;
    }
    if (current === 'round' || current === 'early' || current === 'faked' || current === 'paused') startRound();
  }, [startRound, failRun]);

  const playing = phase !== 'idle' && phase !== 'done';

  // 초록이 화면에 실제로 그려지는 프레임에 시계를 켠다. 레이아웃 효과는 칠하기 전에 돌고,
  // 여기서 건 rAF 는 바로 그 초록 프레임을 칠하기 직전에 돈다 — 렌더링에 걸린 시간을
  // 사람 반응 시간에 얹지 않으려는 것.
  useLayoutEffect(() => {
    if (phase !== 'go') return;
    const id = requestAnimationFrame(() => {
      goAt.current = performance.now();
    });
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // 진행 중에 다른 탭·창으로 가면 브라우저가 타이머를 늦춰서 초록이 늦게 뜨거나, 돌아와서 누른
  // 클릭이 "너무 빨라요"로 잘못 잡힌다. 그래서 화면을 벗어나면 그 회차를 멈추고 돌아와서 다시 한다.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) return;
      const current = phaseRef.current;
      if (current === 'waiting' || current === 'fake' || current === 'go') {
        clearTimers();
        changePhase('paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

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
    <div className="space-y-6">
      {/* 폭은 페이지(app/reaction/page.tsx)가 정한다 — 여기서는 좌우 여백을 따로 주지 않는다. */}
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
      </div>

      {/* 경기장 — 가로는 사이트 폭, 큰 화면에서 세로 600px(내용이 길면 늘어남). 전체화면은 너무 높아서 줄였다(2026-11-16). */}
      <div ref={arenaWrap} className="scroll-mt-5">
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
        // 진행 중 우클릭 메뉴가 경기장을 가리지 않게.
        onContextMenu={playing ? (event) => event.preventDefault() : undefined}
        // 색 전환 애니메이션은 넣지 않는다 — 초록이 서서히 차오르면 그만큼 늦게 보인다.
        className={`relative flex min-h-[380px] select-none flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center sm:min-h-[440px] lg:min-h-[600px] ${ARENA_STYLE[phase]} ${
          playing ? 'cursor-pointer touch-manipulation' : ''
        }`}
      >
        {/* 왼쪽 위 BGM 음량(START 화면부터 결과까지 계속). 늘 첫 자식이라 단계가 바뀌어도 다시 안 붙는다. */}
        <BgmControl />
        {playing && (
          // 폰에선 왼쪽 위 음량 게이지와 겹치지 않게 진행 막대를 조금 내린다(top-14).
          <div className="absolute left-0 right-0 top-14 flex justify-center gap-2 sm:top-5 lg:top-8" aria-label={`${roundNo} / ${REACTION_ROUNDS} 회차`}>
            {Array.from({ length: REACTION_ROUNDS }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full lg:h-3 lg:w-14 ${
                  i < times.length ? 'bg-white' : i === times.length ? 'bg-white/50' : 'bg-white/15'
                }`}
              />
            ))}
          </div>
        )}

        {phase === 'idle' && (
          <>
            {/* 시작 화면 배경(2026-11-16 사용자 요청). 사진은 늘리지 않고 원래 비율로 가운데 높이 꽉,
                남는 좌우는 같은 사진을 크게 흐려 깔아 색이 이어지게 채운다. 위에 어둡게 덮어 글씨를 살린다. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/reaction/idle-bg.webp" alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/reaction/idle-bg.webp"
                alt=""
                className="absolute inset-0 m-auto h-full w-auto object-contain"
                // 좌우 끝을 서서히 투명하게 — 흐린 배경과 경계선 없이 이어지게.
                style={{
                  maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
                }}
              />
              <span className="absolute inset-0 bg-black/45" />
            </span>
            {/* "화내기 금지" — 운영자가 그림판에서 마우스로 직접 쓴 글씨(2026-11-16). 흰 바탕은
                multiply 로 그림에 섞여 사라지고 검은 획만 남아, 배경 그림 위에 쓴 것처럼 보인다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/reaction/no-anger.png"
              alt="화내기 금지"
              className="pointer-events-none absolute right-1 top-3 w-28 mix-blend-multiply sm:right-2 sm:top-4 sm:w-40"
            />
            <p className="relative mt-3 text-2xl font-bold tracking-tight [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] sm:text-3xl lg:text-5xl">초록불이 켜지면 클릭</p>
            <p className="relative mt-2 text-sm text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">빨간불에서 기다리고, 노란불에는 속지 마세요.</p>
            <button
              type="button"
              onClick={startGame}
              className="relative mt-14 rounded-xl bg-accent px-10 py-3 text-base font-bold lg:mt-20 lg:px-14 lg:py-4 lg:text-xl tracking-wide text-[#1A1206] transition-transform hover:scale-[1.03] active:scale-95"
            >
              START
            </button>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">기다리세요…</p>
            <p className="mt-3 text-sm text-white/70">초록불이 켜지면 클릭</p>
          </>
        )}

        {(phase === 'fake' || phase === 'go') && (
          <p className="text-5xl font-black tracking-tight text-[#0E0B13] sm:text-6xl lg:text-9xl">지금!</p>
        )}

        {phase === 'round' && lastMs !== null && (
          <>
            <p className="text-6xl font-black tabular-nums tracking-tight sm:text-7xl lg:text-9xl">
              {lastMs}
              <span className="ml-1 text-2xl font-bold text-menu">ms</span>
            </p>
            <p className="mt-4 text-sm text-menu">클릭해서 다음 회차 ({times.length + 1}/{REACTION_ROUNDS})</p>
          </>
        )}

        {phase === 'early' && (
          <>
            <p className="text-4xl font-bold tracking-tight text-[#FF6B70] sm:text-5xl lg:text-7xl">너무 빨라요!</p>
            <p className="mt-3 text-sm text-menu">초록불이 켜진 다음에 눌러야 해요. 기록이 날아갔어요 — 클릭해서 1회차부터 다시.</p>
            {homeButton}
          </>
        )}

        {phase === 'faked' && (
          <>
            {/* "또 낚였어" 짤을 배경에 흐리게(2026-11-16 사용자 요청). 경기장 전체를 채우게 가로로 늘린다
                (object-fill — 비율 무시). 흰 바탕·검은 선이라 반전(invert)해 어두운 경기장에 녹아들게 한다. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/reaction/faked.png" alt="" className="h-full w-full object-fill opacity-[0.18] invert" />
            </span>
            <p className="relative text-4xl font-bold tracking-tight text-[#F5C518] sm:text-5xl lg:text-7xl">낚였다!</p>
            <p className="relative mt-3 text-sm text-menu">노란불은 페이크예요. 기록이 날아갔어요 — 클릭해서 1회차부터 다시.</p>
            {homeButton}
          </>
        )}

        {phase === 'paused' && (
          <>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">잠깐 멈췄어요</p>
            <p className="mt-3 text-sm text-menu">다른 화면으로 나가서 이 회차는 무효예요. 클릭해서 이 회차 다시.</p>
          </>
        )}

        {phase === 'done' && <Result times={times} mistakes={mistakes} runToken={runToken} onRetry={startGame} onRegistered={onRegistered} />}
      </div>
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
  const [comment, setComment] = useState('');
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
        body: JSON.stringify({ nickname, code, times, token: runToken, comment }),
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
    <div className="w-full max-w-md lg:max-w-xl">
      <p className="hud text-xs text-accent">RESULT · {REACTION_ROUNDS}회 평균</p>
      <p className="mt-2 text-7xl font-black tabular-nums lg:text-9xl tracking-tight">
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
              최고 기록 {result.previousBestMs}ms 보다 느려서 랭킹과 한 줄 평은 그대로예요. (지금 {result.rank}등)
            </p>
          )}
        </div>
      ) : formOpen ? (
        // 입력칸은 좁고 낮게 — 결과 숫자보다 눈에 띄지 않게(2026-11-16 사용자 요청).
        <form onSubmit={submit} className="mx-auto mt-5 max-w-xs space-y-2 text-left">
          <label className="block">
            <span className="text-[11px] text-menu">PUBG 닉네임 (내전에 쓰는 본캐)</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="off"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-[#0E0B13] px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-menu">내전 비밀번호(국룰)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-[#0E0B13] px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="flex justify-between text-[11px] text-menu">
              <span>한 줄 평 (선택)</span>
              <span className="tabular-nums">
                {commentLength(comment)}/{COMMENT_MAX_CHARS}
              </span>
            </span>
            <input
              value={comment}
              // 글자 수는 이모지·한글 한 글자를 1로 센다(maxLength 는 이모지를 2로 세서 직접 자른다).
              onChange={(e) => setComment(Array.from(e.target.value.replace(/\n/g, ' ')).slice(0, COMMENT_MAX_CHARS).join(''))}
              placeholder="랭킹에 같이 올라가요"
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-white/10 bg-[#0E0B13] px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-subtext focus:border-accent"
            />
          </label>
          {error && <p className="text-xs text-[#FF6B70]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-md bg-accent py-2 text-sm font-bold text-[#1A1206] disabled:opacity-50"
            >
              {busy ? '확인 중…' : '등록하기'}
            </button>
            <button type="button" onClick={onRetry} className="rounded-md bg-white/[0.06] px-3 py-2 text-sm text-menu hover:text-foreground">
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
