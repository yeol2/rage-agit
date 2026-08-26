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

  /** 디스코드 웹훅으로 메시지를 보낸다. 응답이 실패면 던진다. */
  export function sendDiscord(webhookUrl: string, content: string): Promise<void>;
}
