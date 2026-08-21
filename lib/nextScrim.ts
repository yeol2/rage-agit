// 내전은 매주 목요일·일요일 한국시간(KST) 저녁 7시 30분에 열린다.
//
// 카운트다운은 클라이언트에서 new Date()로 "지금"을 받는데, 보는 사람 브라우저의
// 로컬 시간대가 KST라는 보장이 없다(배포 서버도 마찬가지) — 그래서 로컬
// getHours()/getDay() 대신 UTC 기준으로 KST 시각을 직접 계산한다. 다른 곳
// (app/api/scrim-roster/round-sheet/route.ts 의 toKstDate 등)과 같은 패턴이다.
const KST_OFFSET_MS = 9 * 3600 * 1000;
const SCRIM_WEEKDAYS_KST = [4, 0]; // KST 기준 요일: 4=목요일, 0=일요일
const SCRIM_HOUR = 19;
const SCRIM_MINUTE = 30;

/**
 * `from` 이후 가장 먼저 열리는 내전 시각(실제 시각 인스턴트 — 어느 시간대에서
 * 봐도 같은 순간을 가리킨다).
 * 내전 당일이라도 시작 시각이 지났으면 다음 회차로 넘어간다.
 */
export function nextScrimDate(from: Date): Date {
  // 목·일은 최대 7일 안에 반드시 한 번은 돌아오므로 8일이면 충분하다.
  for (let i = 0; i < 8; i += 1) {
    const kstFrom = new Date(from.getTime() + KST_OFFSET_MS);
    // kstFrom의 UTC getter들은 "KST로 본 지금"의 연/월/일이다 — 여기에 19:30을
    // 꽂아 만든 UTC 타임스탬프에서 KST_OFFSET_MS를 빼면 그 KST 시각의 실제
    // 순간(instant)이 나온다.
    const candidateKst = new Date(
      Date.UTC(
        kstFrom.getUTCFullYear(),
        kstFrom.getUTCMonth(),
        kstFrom.getUTCDate() + i,
        SCRIM_HOUR,
        SCRIM_MINUTE,
        0,
        0,
      ),
    );
    const candidateInstant = new Date(candidateKst.getTime() - KST_OFFSET_MS);
    if (
      SCRIM_WEEKDAYS_KST.includes(candidateKst.getUTCDay()) &&
      candidateInstant.getTime() > from.getTime()
    ) {
      return candidateInstant;
    }
  }
  return from;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** 남은 시간을 일/시/분/초로 쪼갠다. 이미 지난 시각이면 전부 0. */
export function countdownParts(target: Date, from: Date): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - from.getTime()) / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor(totalSeconds / 3_600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}

/** "2d 1h 23m 45s" 형태. 남은 일수가 0이면 "1h 23m 45s" 처럼 앞자리를 생략한다. */
export function formatCountdown(target: Date, from: Date): string {
  const { days, hours, minutes, seconds } = countdownParts(target, from);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`, `${seconds}s`);
  return parts.join(' ');
}
