import { describe, expect, it, vi } from 'vitest';
import { formatManualPollMessage, formatRosterUploadMessage, sendDiscord } from './notify.mjs';

const base = {
  scrimDate: '2026-08-23',
  roundNo: 1,
  attempt: 3,
  // 20:41:03 KST = 11:41:03 UTC
  pressedAt: '2026-08-23T11:41:03.000Z',
  finishedAt: '2026-08-23T11:41:24.400Z',
  pollingMs: 18900,
  persistMs: 2500,
};

describe('formatManualPollMessage', () => {
  it('몇 번째 라운드가 기록됐는지 적는다', () => {
    // 라운드 하나에 알림 하나다 — 한 세션이면 1~4라운드로 네 번 온다.
    expect(formatManualPollMessage(base)).toContain('2026-08-23 내전 — 1라운드 기록');
    expect(formatManualPollMessage({ ...base, roundNo: 3 })).toContain('3라운드 기록');
  });

  it('누른 시각과 발견 시각을 한국시간으로 적는다', () => {
    const message = formatManualPollMessage(base);
    expect(message).toContain('버튼 누름 20:41:03');
    expect(message).toContain('매치 발견 20:41:24');
    expect(message).toContain('3번째 시도');
  });

  it('총 걸린 시간과 마지막 시도의 단계별 소요를 적는다', () => {
    const message = formatManualPollMessage(base);
    expect(message).toContain('총 걸린 시간 **21.4초**');
    // 세부는 매치를 잡은 마지막 시도만이다 — 총합과 안 맞는 게 정상이라
    // "마지막 시도" 라고 못 박아 둔다.
    expect(message).toContain('마지막 시도: PUBG 조회 18.9초 + 저장·시트 반영 2.5초');
  });

  it('1분을 넘기면 분으로 적는다', () => {
    const message = formatManualPollMessage({
      ...base,
      finishedAt: '2026-08-23T11:43:35.000Z', // 152초
    });
    expect(message).toContain('2분 32초');
  });

  it('1초 미만은 ms 로 적는다', () => {
    const message = formatManualPollMessage({ ...base, persistMs: 420 });
    expect(message).toContain('저장·시트 반영 420ms');
  });

  it('4라운드가 다 차면 리더보드 갱신을 알린다', () => {
    expect(formatManualPollMessage({ ...base, roundNo: 4 })).toContain('4라운드가 다 찼다');
  });

  it('아직 4라운드가 아니면 그 안내는 안 넣는다', () => {
    expect(formatManualPollMessage(base)).not.toContain('4라운드가 다 찼다');
  });
});

describe('sendDiscord', () => {
  it('웹훅에 content 를 담아 POST 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendDiscord('https://webhook.example/abc', '안녕');

    expect(fetchMock).toHaveBeenCalledWith('https://webhook.example/abc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '안녕' }),
    });
    vi.unstubAllGlobals();
  });

  it('응답이 실패면 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'no such webhook' }),
    );

    await expect(sendDiscord('https://webhook.example/gone', '안녕')).rejects.toThrow('404');
    vi.unstubAllGlobals();
  });
});

describe('formatRosterUploadMessage', () => {
  const person = (discordUsername, discordNickname = null) => ({ discordUsername, discordNickname });

  it('전원 찾았으면 그렇다고만 적는다 — 목록이 없어야 목록이 눈에 띈다', () => {
    const message = formatRosterUploadMessage({ totalCount: 24, matchedCount: 24, missing: [] });
    expect(message).toContain('24명 중 24명 확인');
    expect(message).toContain('전원 클랜원 명단에서 찾았다.');
    expect(message).not.toContain('·');
  });

  // 이 알림의 이유다. 화면의 회색 줄은 업로드 직후 팀을 짜다 보면 지나치기 쉽다.
  it('못 찾은 디스코드 ID 를 그대로 적는다 — 복사해서 등록할 수 있어야 한다', () => {
    const message = formatRosterUploadMessage({
      totalCount: 25,
      matchedCount: 23,
      missing: [person('hong_gd', '홍길동'), person('nobody_123')],
    });
    expect(message).toContain('25명 중 23명 확인');
    expect(message).toContain('2명은 디스코드 ID 를 못 찾았다');
    expect(message).toContain('`hong_gd`');
    expect(message).toContain('(파일 속 닉네임: 홍길동)');
    // 닉네임이 없으면 빈 괄호를 남기지 않는다.
    expect(message).toContain('`nobody_123`');
    expect(message).not.toContain('닉네임: )');
  });

  it('스무 명을 넘으면 잘라내고 몇 명 더 있는지 적는다 — 디스코드는 2000자까지다', () => {
    const missing = Array.from({ length: 26 }, (_, i) => person(`user_${i}`));
    const message = formatRosterUploadMessage({ totalCount: 30, matchedCount: 4, missing });
    expect(message).toContain('`user_19`');
    expect(message).not.toContain('`user_20`');
    expect(message).toContain('외 6명');
    expect(message.length).toBeLessThan(2000);
  });
});
