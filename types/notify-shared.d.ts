declare module '@/supabase/functions/_shared/notify.mjs' {
  /** 폴링이 매치를 잡은 순간의 디스코드 알림 문구를 만든다. */
  export function formatManualPollMessage(args: {
    scrimDate: string;
    roundNo: number;
    attempt: number;
    pressedAt: string;
    finishedAt: string;
    pollingMs: number;
    persistMs: number;
  }): string;

  /**
   * 내전 명단 업로드 결과의 디스코드 알림 문구를 만든다.
   * missing 은 파일에는 있는데 members 에서 못 찾은 사람들이다.
   */
  export function formatRosterUploadMessage(args: {
    totalCount: number;
    matchedCount: number;
    missing: { discordUsername: string; discordNickname: string | null }[];
  }): string;

  /** 디스코드 웹훅으로 메시지를 보낸다. 응답이 실패면 던진다. */
  export function sendDiscord(webhookUrl: string, content: string): Promise<void>;
}
