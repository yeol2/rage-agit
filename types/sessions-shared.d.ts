declare module '@/supabase/functions/_shared/sessions.mjs' {
  /**
   * ISO 타임스탬프를 한국시간 기준 날짜(YYYY-MM-DD)로 바꾼다.
   * 내전은 한국시간 저녁에 열리므로 UTC 날짜로 묶으면 사람이 부르는 날짜와 어긋난다.
   */
  export function toKstDate(isoString: string): string;

  /** 한국시간 날짜에서 "2026-08-23 (일) 내전" 형태의 세션 제목을 만든다. */
  export function scrimSessionTitle(kstDate: string): string;
}
