declare module '@/lib/placementPoints.mjs' {
  /** 팀 등수에서 순위 점수를 낸다 (1등 10 / 2등 6 / 3등 5 / 4등 4 / 5등 3 / 6등 2 / 7~8등 1 / 그 아래 0). */
  export function placementPoints(teamRank: number): number;
}
