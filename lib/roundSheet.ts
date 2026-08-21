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

// PUBG 의 team_id 는 매치마다 새로 매겨져서, 같은 4명이라도 라운드마다 다른
// 번호를 받는다. "02 팀 구성 테이블"대로 안 하고 즉석에서 스쿼드를 짠 채로
// 내전을 치른 경우 team_number 로는 실제로 누가 누구랑 뛰었는지 알 수 없다.
// 그래서 라운드 전체에서 "누구랑 누가 몇 번이나 같은 팀이었는지"를 세어
// 스쿼드를 되짚는다 — union-find로 합치되 PUBG 스쿼드 상한(4명)을 넘기면
// 합치지 않는다. 자주 겹친 짝부터 먼저 합쳐야 안정적으로 뭉친다.
export function deriveSquadsFromMatches(matches: MatchParticipantForSquads[][]): Map<string, number> {
  const parent = new Map<string, string>();
  const clusterSize = new Map<string, number>();

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    const combinedSize = (clusterSize.get(rootA) ?? 1) + (clusterSize.get(rootB) ?? 1);
    if (combinedSize > 4) return; // PUBG 스쿼드는 최대 4명
    parent.set(rootA, rootB);
    clusterSize.set(rootB, combinedSize);
  }

  const firstSeenOrder: string[] = [];
  const coOccurrence = new Map<string, number>();

  for (const participants of matches) {
    const byTeamId = new Map<number, string[]>();
    for (const p of participants) {
      if (p.memberId === null) continue;
      if (!parent.has(p.memberId)) {
        parent.set(p.memberId, p.memberId);
        clusterSize.set(p.memberId, 1);
        firstSeenOrder.push(p.memberId);
      }
      const list = byTeamId.get(p.teamId) ?? [];
      list.push(p.memberId);
      byTeamId.set(p.teamId, list);
    }
    for (const members of byTeamId.values()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = [members[i], members[j]].sort().join('|');
          coOccurrence.set(key, (coOccurrence.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const pairsByFrequency = [...coOccurrence.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key] of pairsByFrequency) {
    const [a, b] = key.split('|');
    union(a, b);
  }

  const squadNumberByRoot = new Map<string, number>();
  const squadByMemberId = new Map<string, number>();
  for (const memberId of firstSeenOrder) {
    const root = find(memberId);
    if (!squadNumberByRoot.has(root)) {
      squadNumberByRoot.set(root, squadNumberByRoot.size + 1);
    }
    squadByMemberId.set(memberId, squadNumberByRoot.get(root)!);
  }

  return squadByMemberId;
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

  rows.sort((a, b) => b.totalScore - a.totalScore);
  rows.forEach((row, index) => {
    row.standing = index + 1;
  });

  return rows;
}
