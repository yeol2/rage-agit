// 폴링 결과를 디스코드로 알린다.
// 웹훅 URL 하나면 되고 봇은 필요 없다.

// 한국시간으로 보여준다 — 내전이 한국시간 저녁에 열리므로 UTC 로 적으면 날짜가 헷갈린다.
function toKst(isoString) {
  const d = new Date(new Date(isoString).getTime() + 9 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

export function formatPollingMessage(result, { sinceHours }) {
  // 내전 없는 날이 정상이다. 매번 "이상 없음"을 보내면 알림이 무뎌져서,
  // 정작 실패했을 때 눈에 안 들어온다.
  if (result.scrimsFound === 0 && !result.truncated) return null;

  const lines = [];

  if (result.scrimsFound > 0) {
    const day = toKst(result.scrims[0].playedAt).slice(0, 10);
    lines.push(`**${day} 내전 ${result.scrimsFound}경기 수집**`);
    for (const s of result.scrims) {
      lines.push(
        `· ${toKst(s.playedAt)} — 참가 ${s.participantCount}명 (클랜원 ${s.clanMemberCount}명)`,
      );
    }
  }

  if (result.unregistered.size > 0) {
    const names = [...result.unregistered.keys()].join(', ');
    lines.push('');
    lines.push(`미등록 참가자 ${result.unregistered.size}명: ${names}`);
    lines.push('→ 부계정이면 link-alt-account 로 붙이면 과거 기록까지 연결된다.');
  }

  if (result.truncated) {
    lines.push('');
    lines.push(
      `매치 상한에 걸려 ${result.matchesExamined}건까지만 처리했다. 다음 실행이 이어받는다.`,
    );
  }

  return lines.join('\n');
}

export function formatFailureMessage(error, { sinceHours }) {
  return [
    '**폴링 실패**',
    `되돌아보기 ${sinceHours}시간 설정으로 실행하다 실패했다.`,
    `오류: ${error.message}`,
    '',
    'PUBG API 는 14일치만 보관하므로 그 안에 만회해야 한다:',
    '`node scripts/poll-matches.mjs --since-hours=336`',
  ].join('\n');
}

export async function sendDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`디스코드 전송 실패 ${res.status}: ${await res.text()}`);
}
