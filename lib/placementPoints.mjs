// 내전 순위 점수표. 앱(TypeScript)과 스크린샷 임포트 스크립트(.mjs)가 같은 표를
// 봐야 해서, 둘 다 불러 쓸 수 있게 평범한 .mjs 로 둔다.
//
// 0012 마이그레이션의 placement_points() SQL 함수와 같은 값이다. SQL 은 DB 안에서
// 집계할 때 쓰고 이쪽은 시트를 계산할 때 쓴다 — 표가 바뀌면 두 곳을 같이 고쳐야
// 한다(언어가 달라 더 줄일 수가 없다).
export function placementPoints(teamRank) {
  if (teamRank === 1) return 10;
  if (teamRank === 2) return 6;
  if (teamRank === 3) return 5;
  if (teamRank === 4) return 4;
  if (teamRank === 5) return 3;
  if (teamRank === 6) return 2;
  if (teamRank === 7 || teamRank === 8) return 1;
  return 0;
}
