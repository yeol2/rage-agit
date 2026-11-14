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
   * players 는 PUBG 닉네임 문자열이거나, 시트에서 찾아갈 자리를 같이 담은
   * 객체다 — teamNumber/tierSlot 이 있으면 "3번팀 2티어 미연결" 로 적는다.
   */
  export function formatUnlinkedPlayersMessage(args: {
    scrimDate: string;
    players: (
      | string
      | {
          ign: string;
          name?: string | null;
          teamNumber?: number | null;
          tierSlot?: 1 | 2 | 3 | 4 | null;
        }
    )[];
    /** 실제로 뛴 PUBG 닉 목록 — 묶을 때 복사해 쓰라고 따로 적는다. */
    accounts?: string[];
  }): string;

  /**
   * "팀 구성" 결과를 [안내, 탭 구분 표] 두 메시지로 만든다. 표 메시지는
   * 우클릭 → 텍스트 복사로 통째로 옮기도록 표 말고 아무것도 없다.
   * teams[i] 는 i+1번 팀의 1~4티어 순 이름이다.
   */
  export function formatTeamSheetMessages(args: { teams: string[][] }): [string, string];

  /** 목·일 자동 폴링 크론이 4경기를 잡고 확정·저장한 결과 알림. teams 는 standing 순. */
  export function formatAutoConfirmMessage(args: {
    scrimDate: string;
    confirmedAt: string;
    lowTier: boolean;
    teams: {
      standing: number;
      teamNumber: number;
      totalScore: number;
      totalPlacementPoints: number;
      totalKills: number;
      players?: string[];
    }[];
    savedTeams: number;
    savedMembers: number;
    /** 미연결 명단. 있으면 같은 DM 안에 미등록 참가자 블록을 붙인다. */
    unlinked?: {
      players: (
        | string
        | { ign: string; teamNumber?: number | null; tierSlot?: 1 | 2 | 3 | 4 | null }
      )[];
      accounts?: string[];
    } | null;
  }): string;

  /** 미등록 참가자 알림의 본문(제목 · 누가 어디 · 안 묶인 계정)만. */
  export function formatUnlinkedSummary(args: {
    scrimDate: string;
    players: (
      | string
      | { ign: string; teamNumber?: number | null; tierSlot?: 1 | 2 | 3 | 4 | null }
    )[];
    accounts?: string[];
  }): string;

  /** 디스코드 웹훅으로 메시지를 보낸다. 응답이 실패면 던진다. */
  export function sendDiscord(webhookUrl: string, content: string): Promise<void>;
}
