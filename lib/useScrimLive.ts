'use client';

import { useEffect, useRef } from 'react';
import { getSupabase } from './supabaseBrowser';

/** 0033 의 신호 표에 들어가는 값. 값은 없고 "무엇이 언제 바뀌었다"만 담는다. */
export interface ScrimLiveEvent {
  scrimDate: string;
  kind: 'round' | 'standings';
}

/**
 * 내전 진행 신호를 구독한다. 신호가 오면 onEvent 를 부른다.
 *
 * 여기서 넘어오는 건 "바뀌었다"는 사실뿐이고, 실제 값은 받는 쪽이 평소 쓰던
 * 경로로 다시 조회한다(0033 주석 참고) — 그래야 권한 검사가 그대로 걸린다.
 *
 * onEvent 는 매번 새로 만들어져 넘어오기 마련이라(인라인 화살표 함수), 그대로
 * 의존성에 넣으면 렌더마다 구독을 끊고 다시 맺는다. ref 에 담아두고 구독은
 * 한 번만 맺는다.
 */
export function useScrimLive(onEvent: (event: ScrimLiveEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;

    try {
      channel = getSupabase()
        .channel('scrim-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'scrim_live_events' },
          (payload) => {
            const row = payload.new as { scrim_date?: string; kind?: string };
            if (!row?.scrim_date || (row.kind !== 'round' && row.kind !== 'standings')) return;
            handlerRef.current({ scrimDate: row.scrim_date, kind: row.kind });
          },
        )
        .subscribe();
    } catch {
      // 실시간이 안 붙어도 화면은 평소대로 동작해야 한다 — 새로고침하면 최신이다.
    }

    return () => {
      if (channel) void getSupabase().removeChannel(channel);
    };
  }, []);
}
