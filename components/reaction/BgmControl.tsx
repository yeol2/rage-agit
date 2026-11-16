'use client';

import { useEffect, useRef, useState } from 'react';

// 반응속도 페이지 BGM(2026-11-16 사용자 요청) + 왼쪽 위 음량 게이지.
//
// - 반복 재생. 브라우저는 소리 자동재생을 막아서, 페이지에서 처음 누르는 순간(START 등)부터 튼다.
// - 음량은 이 브라우저에 저장(localStorage) — 다음에 와도 그대로. 못 쓰면 기본값으로 그냥 동작.
// - 경기장 안에 놓이지만 여기를 누른 건 반응속도 클릭이 아니다 — pointerdown 을 위로 안 올린다.

const VOLUME_KEY = 'rage-reaction-bgm-volume';
/** 게이지 기본 위치(0~1). 실제 음량은 아래 toAudioVolume 으로 줄여서 낸다. */
const DEFAULT_VOLUME = 0.5;
/**
 * 음원이 크게 녹음돼 있어서 게이지 끝까지 올려도 원래 음량의 이만큼만(2026-11-16 — 가장 낮게 해도
 * 너무 크다는 요청). 게이지는 제곱 곡선이라 아래쪽에서 아주 작은 소리까지 세밀하게 조절된다.
 */
const MAX_AUDIO_VOLUME = 0.12;

function toAudioVolume(slider: number): number {
  return MAX_AUDIO_VOLUME * slider * slider;
}

function readVolume(): number {
  try {
    const saved = window.localStorage.getItem(VOLUME_KEY);
    const v = saved === null ? NaN : Number(saved);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function BgmControl() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const lastAudible = useRef(DEFAULT_VOLUME);

  // 저장된 음량을 읽고, 첫 사용자 입력에 재생을 시작한다(자동재생 정책).
  useEffect(() => {
    const v = readVolume();
    setVolume(v);
    if (v > 0) lastAudible.current = v;

    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = toAudioVolume(v);
    const start = () => {
      if (audio.volume > 0) audio.play().catch(() => {});
    };
    audio.play().catch(() => {});
    document.addEventListener('pointerdown', start, { once: true });
    document.addEventListener('keydown', start, { once: true });
    return () => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
  }, []);

  const apply = (v: number) => {
    setVolume(v);
    if (v > 0) lastAudible.current = v;
    const audio = audioRef.current;
    if (audio) {
      audio.volume = toAudioVolume(v);
      if (v > 0 && audio.paused) audio.play().catch(() => {});
    }
    try {
      window.localStorage.setItem(VOLUME_KEY, String(v));
    } catch {}
  };

  const muted = volume === 0;

  return (
    <div
      className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm"
      // 반응속도 클릭으로 세지 않게.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src="/reaction/bgm.mp3" loop preload="auto" />
      <button
        type="button"
        onClick={() => apply(muted ? lastAudible.current || DEFAULT_VOLUME : 0)}
        aria-label={muted ? '배경음악 켜기' : '배경음악 끄기'}
        className="text-white/90 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
          {muted ? (
            <>
              <path d="m22 9-6 6" />
              <path d="m16 9 6 6" />
            </>
          ) : (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              {volume > 0.5 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
            </>
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(volume * 100)}
        onChange={(e) => apply(Number(e.target.value) / 100)}
        aria-label="배경음악 음량"
        className="h-1.5 w-20 cursor-pointer accent-[#FF9233] sm:w-28"
      />
    </div>
  );
}
