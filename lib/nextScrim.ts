// 내전은 매주 목요일·금요일 저녁 7시 30분에 열린다.
const SCRIM_WEEKDAYS = [4, 5]; // 4=목, 5=금
const SCRIM_HOUR = 19;
const SCRIM_MINUTE = 30;

/**
 * `from` 이후 가장 먼저 열리는 내전 시각.
 * 내전 당일이라도 시작 시각이 지났으면 다음 회차로 넘어간다.
 */
export function nextScrimDate(from: Date): Date {
  // 목·금은 최대 7일 안에 반드시 한 번은 돌아오므로 8일이면 충분하다.
  for (let i = 0; i < 8; i += 1) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + i);
    candidate.setHours(SCRIM_HOUR, SCRIM_MINUTE, 0, 0);
    if (SCRIM_WEEKDAYS.includes(candidate.getDay()) && candidate.getTime() > from.getTime()) {
      return candidate;
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
