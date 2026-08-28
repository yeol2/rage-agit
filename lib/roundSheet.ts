// 03 내전 시트 — 팀별 라운드(매치) 점수를 계산한다. 저장은 안 하고 매번
// match_participants + scrim_roster_entries.team_number 로 즉석 계산한다.

// 점수표는 스크린샷 임포트 스크립트(.mjs)와 같아야 해서 lib/placementPoints.mjs
// 한 곳에 둔다. 여기서 다시 내보내 기존 import 경로를 그대로 유지한다.
import { placementPoints } from '@/lib/placementPoints.mjs';

export interface RoundParticipant {
  memberId: string | null;
  kills: number;
  teamRank: number;
}

export interface RosterMemberForScoring {
  memberId: string;
  teamNumber: number;
}

export interface TeamRoundResult {
  teamNumber: number;
  // 이 팀 소속으로 매칭된 인원이 그 매치에 하나도 없으면 둘 다 null("-" 표시용).
  kills: number | null;
  teamRank: number | null;
}

export { placementPoints };

// 매치(라운드) 하나의 참가자 목록에서 이 로스터의 팀별 킬합계·순위를 뽑는다.
// 팀원끼리는 실제 게임에서 같은 team_rank 를 공유하는 게 정상이지만, 혹시
// 어긋나면 방어적으로 최솟값(더 높은 순위)을 쓴다.
export function computeTeamRoundResults(
  participants: RoundParticipant[],
  rosterMembers: RosterMemberForScoring[],
  teamNumbers: number[],
): TeamRoundResult[] {
  const teamNumberByMemberId = new Map(rosterMembers.map((m) => [m.memberId, m.teamNumber]));
  const grouped = new Map<number, { kills: number; teamRanks: number[] }>();

  for (const participant of participants) {
    if (participant.memberId === null) continue;
    const teamNumber = teamNumberByMemberId.get(participant.memberId);
    if (teamNumber === undefined) continue;

    const bucket = grouped.get(teamNumber) ?? { kills: 0, teamRanks: [] };
    bucket.kills += participant.kills;
    bucket.teamRanks.push(participant.teamRank);
    grouped.set(teamNumber, bucket);
  }

  return teamNumbers.map((teamNumber) => {
    const bucket = grouped.get(teamNumber);
    if (!bucket || bucket.teamRanks.length === 0) {
      return { teamNumber, kills: null, teamRank: null };
    }
    return { teamNumber, kills: bucket.kills, teamRank: Math.min(...bucket.teamRanks) };
  });
}

export interface RoundSheetRound {
  roundNo: number;
  kills: number | null;
  teamRank: number | null;
  // 그 라운드의 team_rank에 해당하는 배치점수(placementPoints) — 매칭 안
  // 됐으면(teamRank null) 이것도 null.
  rankScore: number | null;
  // 그 라운드만의 합계(kills + rankScore) — 누적이 아니다. 누적 순위는
  // RoundSheetRow.totalScore 가 따로 낸다.
  roundTotal: number;
}

export interface RoundSheetRow {
  teamNumber: number;
  // 최종 누적 Total 기준 정렬 순위(1~16) — 메달·행 순서를 정하는 값. 시트의
  // "PLACE" 칸(배치점수 누적)과는 다른 개념이라 이름을 구분해뒀다.
  standing: number;
  totalKills: number;
  totalPlacementPoints: number;
  totalScore: number;
  rounds: RoundSheetRound[];
}

export interface MatchParticipantForSquads {
  memberId: string | null;
  teamId: number;
}

export interface SquadAssignment {
  /** 클랜원 → 그 사람이 뛴 팀 번호(PUBG team_id). */
  squadByMemberId: Map<string, number>;
  /**
   * 한 세션 안에서 team_id 가 라운드마다 달랐던 사람들.
   *
   * 비어 있는 게 정상이다. 값이 있으면 아래 전제가 깨졌다는 뜻이므로 화면이
   * 경고를 띄운다 — 조용히 틀린 시트를 보여주는 것보다 낫다.
   */
  unstableMemberIds: string[];
}

/**
 * 라운드별 참가 기록에서 스쿼드를 뽑는다. 번호는 PUBG 가 매긴 team_id 를 그대로 쓴다.
 *
 * 전제: 한 세션(4라운드) 동안 team_id 는 안 바뀐다. 실측으로 확인했다 —
 * 2026-08-01 이후 7세션에서 team_id 로 묶으면 늘 16팀 × 정확히 4명이고,
 * 라운드 사이에 번호가 바뀐 사람은 0명이다.
 *
 * 그 전(~2026-07-25)에는 라운드마다 번호가 새로 매겨져서, 같은 방식으로 묶으면
 * 한 팀에 7~16명이 들어갔다. 그래서 예전에는 "누가 누구랑 몇 번이나 같은
 * 팀이었나"를 세어 되짚었는데(union-find), 그러면 번호를 새로 지어내야 하고
 * 그 번호가 행이 도착한 순서에 따라 달라졌다 — 같은 경기인데 보는 사람마다
 * (#01)이 (#16)으로 보일 수 있었다. team_id 를 그대로 쓰면 그 문제가 사라지고,
 * 덤으로 시트의 팀 번호가 사람들이 게임 안에서 본 번호와 일치한다.
 *
 * 선수 교체로 한 팀에 5명 이상이 매핑될 수 있다. 그건 정상이다 —
 * 라운드별 점수는 그 판에 실제로 뛴 사람만 더하므로(computeTeamRoundResults)
 * 합계가 부풀지 않는다.
 */
export function squadsFromTeamIds(matches: MatchParticipantForSquads[][]): SquadAssignment {
  const squadByMemberId = new Map<string, number>();
  const unstableMemberIds: string[] = [];

  // 라운드 순서대로(matches 는 played_at 오름차순) 돌면서 처음 본 번호를 쓴다.
  for (const participants of matches) {
    for (const { memberId, teamId } of participants) {
      if (memberId === null) continue; // 미등록 참가자는 시트에 안 올라간다
      const existing = squadByMemberId.get(memberId);
      if (existing === undefined) {
        squadByMemberId.set(memberId, teamId);
      } else if (existing !== teamId && !unstableMemberIds.includes(memberId)) {
        unstableMemberIds.push(memberId);
      }
    }
  }

  return { squadByMemberId, unstableMemberIds };
}

// 라운드별(매치 순서대로) 팀 결과를 받아 누적 킬/배치점수/Total과 최종 순위
// (standing)까지 낸다. 매칭 안 된 팀(kills/teamRank null)은 그 라운드
// 킬·배치점수를 0으로 취급한다.
export function computeRoundSheet(
  roundsResults: TeamRoundResult[][],
  teamNumbers: number[],
): RoundSheetRow[] {
  const cumulativeKills = new Map<number, number>(teamNumbers.map((t) => [t, 0]));
  const cumulativePlacementPoints = new Map<number, number>(teamNumbers.map((t) => [t, 0]));
  const cumulativeScore = new Map<number, number>(teamNumbers.map((t) => [t, 0]));
  const roundsByTeam = new Map<number, RoundSheetRound[]>(teamNumbers.map((t) => [t, []]));

  roundsResults.forEach((roundResult, index) => {
    const roundNo = index + 1;
    for (const { teamNumber, kills, teamRank } of roundResult) {
      const roundPlacementPoints = teamRank !== null ? placementPoints(teamRank) : 0;
      const roundScore = (kills ?? 0) + roundPlacementPoints;
      cumulativeKills.set(teamNumber, (cumulativeKills.get(teamNumber) ?? 0) + (kills ?? 0));
      cumulativePlacementPoints.set(
        teamNumber,
        (cumulativePlacementPoints.get(teamNumber) ?? 0) + roundPlacementPoints,
      );
      cumulativeScore.set(teamNumber, (cumulativeScore.get(teamNumber) ?? 0) + roundScore);
      roundsByTeam.get(teamNumber)?.push({
        roundNo,
        kills,
        teamRank,
        rankScore: teamRank !== null ? roundPlacementPoints : null,
        roundTotal: roundScore,
      });
    }
  });

  const rows: RoundSheetRow[] = teamNumbers.map((teamNumber) => ({
    teamNumber,
    standing: 0,
    totalKills: cumulativeKills.get(teamNumber) ?? 0,
    totalPlacementPoints: cumulativePlacementPoints.get(teamNumber) ?? 0,
    totalScore: cumulativeScore.get(teamNumber) ?? 0,
    rounds: roundsByTeam.get(teamNumber) ?? [],
  }));

  // 총점이 같으면 순위점수(PLACE)가 높은 쪽이 위다 — 0027 주석이 적어둔 시트의
  // 규칙이고, 2026-07-20 이 실제로 42점 동점에서 순위점수 17 대 16 으로 갈렸다
  // (data/session-winners.json). 그것도 같으면 팀번호 순으로 둔다.
  //
  // 우승팀 하나만 볼 때는 동점이 나도 대개 티가 안 났지만, 0028 부터는 1~16
  // 전부를 저장하므로 동점의 앞뒤가 그대로 기록에 남는다.
  rows.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.totalPlacementPoints - a.totalPlacementPoints ||
      a.teamNumber - b.teamNumber,
  );
  rows.forEach((row, index) => {
    row.standing = index + 1;
  });

  return rows;
}
