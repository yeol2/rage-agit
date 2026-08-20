// 03 내전 시트 — 팀별 라운드(매치) 점수를 계산한다. 저장은 안 하고 매번
// match_participants + scrim_roster_entries.team_number 로 즉석 계산한다.

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

// 0012 마이그레이션의 placement_points() SQL 함수를 그대로 옮긴 값이다 —
// 점수표가 바뀌면 두 곳 다 고쳐야 한다.
export function placementPoints(teamRank: number): number {
  if (teamRank === 1) return 10;
  if (teamRank === 2) return 6;
  if (teamRank === 3) return 5;
  if (teamRank === 4) return 4;
  if (teamRank === 5) return 3;
  if (teamRank === 6) return 2;
  if (teamRank === 7 || teamRank === 8) return 1;
  return 0;
}

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
  cumulativeTotal: number;
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
        cumulativeTotal: cumulativeScore.get(teamNumber) ?? 0,
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

  rows.sort((a, b) => b.totalScore - a.totalScore);
  rows.forEach((row, index) => {
    row.standing = index + 1;
  });

  return rows;
}
