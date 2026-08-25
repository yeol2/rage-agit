// 03 내전 시트의 "폴링" 버튼 결과를 디스코드로 알린다.
// 웹훅 URL 하나면 되고 봇은 필요 없다.
//
// 내전 도중에는 매 라운드가 끝날 때마다 이 버튼을 누른다. 눌러놓고 다른 걸
// 보고 있어도 "몇 초 만에 들어왔는지"가 남아야, 다음에 언제쯤 누르면 되는지
// 감이 잡힌다.

// 한국시간으로 보여준다 — 내전이 한국시간 저녁에 열리므로 UTC 로 적으면 헷갈린다.
function toKstTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// 밀리초를 사람이 읽는 길이로. 1분을 넘기는 일이 잦아서 분까지 쓴다.
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}초`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${Math.round(seconds - minutes * 60)}초`;
}

// 한 세션은 4라운드다. 이 수를 채우면 리더보드 갱신과 우승 확정이 열린다.
const ROUNDS_PER_SESSION = 4;

/**
 * 새로 기록된 라운드 하나를 알리는 문구.
 *
 * **라운드 하나에 알림 하나다.** 한 세션이면 4번 온다. 한 번 폴링에 매치가
 * 둘 이상 잡히면(늦게 눌렀을 때) 그만큼 여러 번 부른다 — 라운드 하나가
 * 조용히 넘어가면 어디까지 들어왔는지 세기 어렵다.
 *
 * 못 잡은 시도는 부르지 않는다 — 버튼 한 번에 최대 수십 번 두드리므로
 * 매번 보내면 알림이 무뎌져서 정작 볼 것이 안 보인다.
 */
export function formatManualPollMessage({
  scrimDate,
  roundNo,
  attempt,
  pressedAt,
  finishedAt,
  pollingMs,
  persistMs,
}) {
  const totalMs = new Date(finishedAt).getTime() - new Date(pressedAt).getTime();
  const lines = [
    `**폴링 완료!** ${scrimDate} 내전 — ${roundNo}라운드 기록`,
    `· 버튼 누름 ${toKstTime(pressedAt)} → 매치 발견 ${toKstTime(finishedAt)}`,
    `· 총 걸린 시간 **${formatDuration(totalMs)}** (${attempt}번째 시도에서 발견)`,
    // 아래 둘은 매치를 잡은 마지막 시도만의 시간이다. 총 시간에는 그 앞의
    // 헛시도와 시도 사이 대기가 다 들어 있어서, 둘을 더해도 총합이 안 된다.
    `   └ 마지막 시도: PUBG 조회 ${formatDuration(pollingMs)} + 저장·시트 반영 ${formatDuration(persistMs)}`,
  ];

  // 마지막 라운드까지 차면 등수 스냅샷과 리더보드 갱신도 이때 일어난다.
  if (roundNo >= ROUNDS_PER_SESSION) {
    lines.push('');
    lines.push(
      `${ROUNDS_PER_SESSION}라운드가 다 찼다 — 리더보드를 갱신했다. 우승 확정을 누르면 된다.`,
    );
  }

  return lines.join('\n');
}

export async function sendDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`디스코드 전송 실패 ${res.status}: ${await res.text()}`);
}
