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

  /**
   * 그 내전에서 아직 클랜원과 안 묶인 참가자를 알리는 문구.
   * players 는 PUBG 닉네임 목록이다.
   */
  export function formatUnlinkedPlayersMessage(args: {
    scrimDate: string;
    players: string[];
  }): string;

  /**
   * "팀 구성" 결과를 [안내, 탭 구분 표] 두 메시지로 만든다. 표 메시지는
   * 우클릭 → 텍스트 복사로 통째로 옮기도록 표 말고 아무것도 없다.
   * teams[i] 는 i+1번 팀의 1~4티어 순 이름이다.
   */
  export function formatTeamSheetMessages(args: { teams: string[][] }): [string, string];

  /** 디스코드 웹훅으로 메시지를 보낸다. 응답이 실패면 던진다. */
  export function sendDiscord(webhookUrl: string, content: string): Promise<void>;
}
