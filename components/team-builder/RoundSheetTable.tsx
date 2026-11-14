import { Fragment } from 'react';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';

// 03 내전 시트의 표 부분만. 버튼·토글이 없는 순수 표라 서버에서도 그릴 수 있다 —
// 03 시트(RoundSheet)는 이 표 아래에 폴링·우승 확정 버튼을 붙이고, 내전 기록
// 화면(/matches)은 표만 가운데에 띄운다.

export interface RoundSheetRound {
  roundNo: number;
  kills: number | null;
  teamRank: number | null;
  rankScore: number | null;
  roundTotal: number;
}

export interface RoundSheetTeam {
  teamNumber: number;
  standing: number;
  players: string[];
  totalKills: number;
  totalPlacementPoints: number;
  totalScore: number;
  rounds: RoundSheetRound[];
}

export interface RoundSheetResponse {
  /** 이 시트가 그린 내전 날짜. 아직 한 번도 내전이 없으면 null. */
  scrimDate: string | null;
  roundCount: number;
  teams: RoundSheetTeam[];
  /**
   * 세션 도중 PUBG 팀 번호가 바뀐 사람. 팀 번호를 team_id 로 삼는 전제가
   * 깨졌다는 뜻이라, 조용히 이상한 시트를 보여주지 않고 여기서 알린다.
   */
  unstableTeamPlayers?: string[];
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// 원본 참고 시트(Ez 클랜 내전.xlsx, "ROUND(1~4)" 탭)에서 실측한 배색이다 —
// PLACE/KILL, Rank/RankScore/Kill 칸은 무색이고 TOTAL(누적) 칸만 색이 들어간다.
// 요약 TOTAL은 핑크(#EAD1DC), ROUND는 보라(#D9D2E9)/파랑(#C9DAF8)을 홀짝으로
// 번갈아 쓴다. 어두운 테마 위라 그대로 옮기지 않고 반투명 버전을 쓴다.
const GROUP_COLORS = {
  summary: { bg: 'bg-pink-500/15', border: 'border-pink-400/40', text: 'text-pink-200' },
  purple: { bg: 'bg-purple-500/15', border: 'border-purple-400/40', text: 'text-purple-200' },
  blue: { bg: 'bg-blue-500/15', border: 'border-blue-400/40', text: 'text-blue-200' },
} as const;

function roundColor(roundNo: number) {
  return roundNo % 2 === 1 ? GROUP_COLORS.purple : GROUP_COLORS.blue;
}

export function cleanName(name: string): string {
  const cleaned = stripTrailingKoreanTag(cleanDisplayName(name));
  return cleaned.startsWith('Ez_') ? cleaned.slice(3) : cleaned;
}

// 원본 시트처럼 모든 칸에 테두리를 두르고, 전부 중앙 정렬한다.
const BASE_CELL = 'border border-white/20 p-1 overflow-hidden text-center';
const TINTED_CELL = 'border p-1 overflow-hidden text-center';

// 숫자만 들어가는 좁은 칸(순위/라운드별 Rank·RankScore·Kill·Total)은 40px
// 정사각형으로 맞춘다. 종합 PLACE/KILL/TOTAL(요약 3칸)만 자릿수가 더 커질 수
// 있어 48px로 살짝 더 크게 잡는다.
const SQUARE_CELL_SIZE = 40;
const TOTAL_CELL_SIZE = 48;
const SQUARE_CELL_STYLE = { width: SQUARE_CELL_SIZE, height: SQUARE_CELL_SIZE, boxSizing: 'border-box' } as const;
// TEAM/PLAYER처럼 텍스트가 들어가는 칸은 폭은 따로 정하고 높이만 정사각형에 맞춘다.
const ROW_HEIGHT_STYLE = { height: SQUARE_CELL_SIZE, boxSizing: 'border-box' } as const;
const SUMMARY_CELL_STYLE = { width: TOTAL_CELL_SIZE, height: SQUARE_CELL_SIZE, boxSizing: 'border-box' } as const;
// 라운드별 Total은 다시 다른 라운드 칸과 같은 40px 정사각형으로.
const ROUND_TOTAL_CELL_STYLE = SQUARE_CELL_STYLE;

// TEAM((#01) 같은 4글자)은 그렇게 넓을 필요가 없어서 좁게 잡는다.
const TEAM_COL_WIDTH = 48;
const SUMMARY_COL_WIDTH = TOTAL_CELL_SIZE; // PLACE/KILL/TOTAL
const SQUARE_COL_COUNT_BASE = 1; // 🏆
const ROUND_COUNT = 4;
// 라운드 하나당 폭 = Rank + RankScore + Kill + Total(전부 40).
const ROUND_WIDTH = SQUARE_CELL_SIZE * 4;
// 페이지 폭을 <table>이 실제로 쓸 수 있는 만큼(브라우저로 재서 넣은 값 — 03
// 섹션의 좌우 여백을 뺀 실측치) 꽉 채우도록, 다른 칸을 다 고정한 뒤 남는
// 폭을 전부 PLAYER 칸에 몰아준다. -2는 border-collapse 반올림으로 가로
// 스크롤바가 생기는 걸 막는 여유분.
const AVAILABLE_WIDTH = 1136 - 2;
const PLAYER_COL_WIDTH =
  AVAILABLE_WIDTH -
  (SQUARE_COL_COUNT_BASE * SQUARE_CELL_SIZE + TEAM_COL_WIDTH + 3 * SUMMARY_COL_WIDTH + ROUND_COUNT * ROUND_WIDTH);
// <table>에 폭을 안 주면 table-layout:fixed라도 내용(특히 긴 플레이어 이름)이
// 넘칠 때 칸이 도로 늘어난다 — 정사각형을 유지하려면 전체 폭을 명시적으로
// 고정해야 한다.
export const TABLE_WIDTH =
  SQUARE_COL_COUNT_BASE * SQUARE_CELL_SIZE +
  TEAM_COL_WIDTH +
  PLAYER_COL_WIDTH +
  3 * SUMMARY_COL_WIDTH +
  ROUND_COUNT * ROUND_WIDTH;

export function RoundSheetTable({ data }: { data: Pick<RoundSheetResponse, 'teams'> }) {
  // 폴링된 만큼만이 아니라 1~4라운드 전체 껍데기를 항상 그려둔다 — 아직 안
  // 온 라운드는 "-"로 비워둔 채, 폴링될 때마다 그 칸이 채워지는 방식.
  const rounds = [1, 2, 3, 4] as const;

  return (
    <div className="overflow-x-auto">
      <table
        aria-label="내전 시트"
        className="mx-auto border-collapse text-xs"
        style={{ tableLayout: 'fixed', width: TABLE_WIDTH }}
      >
        <colgroup>
          <col style={{ width: SQUARE_CELL_SIZE }} />
          <col style={{ width: TEAM_COL_WIDTH }} />
          <col style={{ width: PLAYER_COL_WIDTH }} />
          <col style={{ width: SUMMARY_COL_WIDTH }} />
          <col style={{ width: SUMMARY_COL_WIDTH }} />
          <col style={{ width: SUMMARY_COL_WIDTH }} />
          {rounds.map((roundNo) => (
            <Fragment key={roundNo}>
              <col style={{ width: SQUARE_CELL_SIZE }} />
              <col style={{ width: SQUARE_CELL_SIZE }} />
              <col style={{ width: SQUARE_CELL_SIZE }} />
              <col style={{ width: SQUARE_CELL_SIZE }} />
            </Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={SQUARE_CELL_STYLE} className={BASE_CELL}>
              🏆
            </th>
            <th rowSpan={2} style={ROW_HEIGHT_STYLE} className={BASE_CELL}>
              TEAM
            </th>
            <th rowSpan={2} style={ROW_HEIGHT_STYLE} className={BASE_CELL}>
              PLAYER
            </th>
            <th rowSpan={2} style={SUMMARY_CELL_STYLE} className={BASE_CELL}>
              PLACE
            </th>
            <th rowSpan={2} style={SUMMARY_CELL_STYLE} className={BASE_CELL}>
              KILL
            </th>
            <th
              rowSpan={2}
              style={SUMMARY_CELL_STYLE}
              className={`${TINTED_CELL} ${GROUP_COLORS.summary.bg} ${GROUP_COLORS.summary.border} ${GROUP_COLORS.summary.text}`}
            >
              TOTAL
            </th>
            {rounds.map((roundNo) => {
              const color = roundColor(roundNo);
              return (
                <th
                  key={roundNo}
                  colSpan={4}
                  style={ROW_HEIGHT_STYLE}
                  className={`${TINTED_CELL} ${color.bg} ${color.border} ${color.text}`}
                >
                  ROUND {roundNo}
                </th>
              );
            })}
          </tr>
          <tr>
            {rounds.map((roundNo) => {
              const color = roundColor(roundNo);
              return (
                <Fragment key={roundNo}>
                  <th colSpan={2} style={ROW_HEIGHT_STYLE} className={BASE_CELL}>
                    Rank
                  </th>
                  <th style={SQUARE_CELL_STYLE} className={BASE_CELL}>
                    Kill
                  </th>
                  <th
                    style={ROUND_TOTAL_CELL_STYLE}
                    className={`${TINTED_CELL} ${color.bg} ${color.border} ${color.text}`}
                  >
                    Total
                  </th>
                </Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.teams.map((team) => (
            <tr key={team.teamNumber}>
              <td style={SQUARE_CELL_STYLE} className={BASE_CELL}>
                {MEDALS[team.standing] ?? team.standing}
              </td>
              <td style={ROW_HEIGHT_STYLE} className={BASE_CELL}>
                (#{String(team.teamNumber).padStart(2, '0')})
              </td>
              <td
                style={ROW_HEIGHT_STYLE}
                className={`${BASE_CELL} overflow-hidden text-ellipsis whitespace-nowrap`}
                title={team.players.map(cleanName).join(' / ')}
              >
                {team.players.map(cleanName).join(' / ')}
              </td>
              <td style={SUMMARY_CELL_STYLE} className={BASE_CELL}>
                {team.totalPlacementPoints}
              </td>
              <td style={SUMMARY_CELL_STYLE} className={BASE_CELL}>
                {team.totalKills}
              </td>
              <td
                style={SUMMARY_CELL_STYLE}
                className={`${TINTED_CELL} ${GROUP_COLORS.summary.bg} ${GROUP_COLORS.summary.border} font-bold`}
              >
                {team.totalScore}
              </td>
              {rounds.map((roundNo) => {
                const round = team.rounds.find((r) => r.roundNo === roundNo);
                const color = roundColor(roundNo);
                return (
                  <Fragment key={roundNo}>
                    <td style={SQUARE_CELL_STYLE} className={BASE_CELL}>
                      {round?.teamRank ?? '-'}
                    </td>
                    <td style={SQUARE_CELL_STYLE} className={BASE_CELL}>
                      {round?.rankScore ?? '-'}
                    </td>
                    <td style={SQUARE_CELL_STYLE} className={BASE_CELL}>
                      {round?.kills ?? '-'}
                    </td>
                    <td style={ROUND_TOTAL_CELL_STYLE} className={`${TINTED_CELL} ${color.bg} ${color.border}`}>
                      {round?.roundTotal ?? '-'}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
