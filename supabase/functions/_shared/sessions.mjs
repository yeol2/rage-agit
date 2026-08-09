// 내전 세션의 날짜와 제목. Node 스크립트와 Deno Edge Function 이 함께 쓴다.
//
// 내전은 한국시간 저녁 8시~9시 40분에 열린다(실측). 매치는 UTC 로 저장되므로
// UTC 날짜로 묶으면 사람이 "8월 9일 내전"이라 부르는 것과 어긋날 수 있다.
// 그래서 묶는 기준을 한국시간 날짜로 잡는다.

const KST_OFFSET_MS = 9 * 3600 * 1000;
const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toKstDate(isoString) {
  const kst = new Date(new Date(isoString).getTime() + KST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

export function scrimSessionTitle(kstDate) {
  const [year, month, day] = kstDate.split('-').map(Number);
  const weekday = KOREAN_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${kstDate} (${weekday}) 내전`;
}
