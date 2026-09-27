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

// 명단에 있는데 members 에서 못 찾은 디스코드 ID 를 한 번에 몇 명까지 적을지.
// 디스코드 메시지는 2000자 제한이 있고, 스무 명을 넘겼다면 목록을 다 읽는 것보다
// "뭔가 크게 어긋났다"는 사실이 먼저 전해져야 한다.
const MAX_LISTED_MISSING = 20;

/**
 * 내전 명단 txt 업로드 결과를 알린다.
 *
 * **못 찾은 ID 를 이름으로 적는 것이 이 알림의 전부다.** 화면은 못 찾은 사람을
 * 회색 줄로 보여주지만, 관리자는 업로드 직후 팀을 짜느라 그 줄을 지나치기 쉽고
 * 나중에 누구를 등록해야 했는지 되짚기 어렵다. 그래서 ID 를 남긴다 — members 에
 * 등록할 때 그대로 복사해 쓸 수 있어야 하므로 코드 서식으로 감싼다.
 *
 * 전원 확인된 경우에도 보낸다. 업로드가 됐다는 사실 자체가 알림 값이고, 조용하면
 * 웹훅이 죽은 것인지 다 맞은 것인지 구분되지 않는다.
 *
 * missing 은 파일에는 있는데 members 에 없는 사람들이다. 닉네임은 업로드 파일
 * 쪽 값이라 비어 있을 수 있지만, 못 찾은 사람에게는 그것이 유일한 단서다.
 */
export function formatRosterUploadMessage({ totalCount, matchedCount, missing }) {
  const missingCount = totalCount - matchedCount;
  const lines = [`**내전 명단 업로드 완료** — ${totalCount}명 중 ${matchedCount}명 확인`];

  if (missingCount === 0) {
    lines.push('전원 클랜원 명단에서 찾았다.');
    return lines.join('\n');
  }

  lines.push(`**${missingCount}명은 디스코드 ID 를 못 찾았다.**`);
  lines.push('');
  for (const person of missing.slice(0, MAX_LISTED_MISSING)) {
    const hint = person.discordNickname ? ` (파일 속 닉네임: ${person.discordNickname})` : '';
    lines.push(`· \`${person.discordUsername}\`${hint}`);
  }
  if (missing.length > MAX_LISTED_MISSING) {
    lines.push(`· … 외 ${missing.length - MAX_LISTED_MISSING}명`);
  }
  lines.push('');
  lines.push('클랜원 명단에 discord_username 을 등록하면 다음 업로드부터 잡힌다.');

  return lines.join('\n');
}

/**
 * 그 내전에서 아직 클랜원과 안 묶인 참가자를 알린다.
 *
 * 폴링은 매치 참가자를 **전원** 저장하지만, 그중 어느 PUBG 계정이 누구인지는
 * `member_pubg_accounts` 에 등록돼 있어야만 안다. 안 묶인 사람은 시트에 PUBG
 * 닉네임 그대로 뜨고 팀 킬 합계에는 들어가지만, **그 사람 개인 기록에는 아무것도
 * 안 남는다** — 리더보드도 깐부도 맵 기록도 통째로 빠진다.
 *
 * 2026-09-03 내전이 그랬다. Ez_2pan4pan 이 부계정으로 뛰었는데 계정이 안 묶여
 * 있어서 4경기가 통째로 사라졌고, 다음 날 시트를 눈으로 보다가 "9번 팀이 3명이네"
 * 하고 발견했다. 그래서 그날 바로 알도록 한다.
 *
 * 대개는 외부인이 아니라 우리 클랜원의 부계정이다. 묶는 방법까지 같이 적어둔다.
 */
export function formatUnlinkedPlayersMessage({ scrimDate, players }) {
  const lines = [`**미등록 참가자** ${scrimDate} 내전 — ${players.length}명이 클랜원과 안 묶였다.`, ''];
  for (const ign of players.slice(0, MAX_LISTED_MISSING)) lines.push(`· \`${ign}\``);
  if (players.length > MAX_LISTED_MISSING) {
    lines.push(`· … 외 ${players.length - MAX_LISTED_MISSING}명`);
  }
  lines.push('');
  lines.push('시트에는 이 닉네임 그대로 뜨고 팀 점수에도 들어간다.');
  lines.push('다만 개인 기록(리더보드·깐부·맵)에는 안 남으니, 부계정이면 묶어줄 것:');
  lines.push('`node scripts/link-alt-account.mjs <본계정> <부계정>` → `node scripts/relink-participants.mjs`');
  return lines.join('\n');
}

/**
 * "팀 구성" 버튼 결과를 엑셀 내전 시트에 붙여넣을 수 있게 보낸다.
 *
 * 시트는 A열에 (#01)~(#16) 팀 번호가 이미 적혀 있고 B~E열이 팀원1~4 칸이다.
 * 그래서 팀 번호 없이 **한 줄에 한 팀, 칸 사이는 탭**으로만 적는다.
 *
 * **메시지를 두 개로 나눠 보낸다(안내 → 표).** 디스코드에서 표를 옮기는 가장
 * 쉬운 방법이 메시지 우클릭 → "텍스트 복사"인데, 이건 메시지 원문을 통째로
 * 복사한다. 안내 문구나 코드블록 ``` 가 같은 메시지에 있으면 그것까지 딸려와서
 * 시트에 쓰레기 줄이 생긴다 — 그래서 표 메시지에는 표 말고 아무것도 넣지 않는다.
 * 코드블록 없이 보내면 화면에서는 이름 속 `_` 가 기울임으로 보일 수 있지만,
 * "텍스트 복사"는 원문을 가져가므로 붙여넣은 값은 정확하다.
 *
 * 디스코드는 메시지 맨 앞·맨 뒤의 공백(탭 포함)을 잘라낸다(실제로 확인함).
 * 1번 팀 1티어가 비어 있으면 그 줄 전체가 한 칸씩 당겨지므로, 빈 자리는
 * 빈 문자열 대신 `?` 로 채운다.
 *
 * teams[i] 는 i+1번 팀의 1~4티어 순 이름이다. [안내, 표] 순으로 돌려준다.
 */
export function formatTeamSheetMessages({ teams }) {
  const rows = teams.map((members) => members.map((name) => name || '?').join('\t'));
  return [
    `**팀 구성 완료** — ${teams.length}팀 · 아래 메시지 우클릭 → 텍스트 복사 → 시트 팀원1 칸에서 Ctrl+Shift+V`,
    rows.join('\n'),
  ];
}

export async function sendDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`디스코드 전송 실패 ${res.status}: ${await res.text()}`);
}
