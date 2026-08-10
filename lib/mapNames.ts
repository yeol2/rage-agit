// PUBG API 의 맵 값을 화면에 쓰는 한글 이름으로 바꾼다.
//
// scripts/lib/dakgg.mjs 의 MAP_NAMES 는 이것의 반대 방향이다(한글 → API).
// 그쪽은 dak.gg 화면을 읽을 때 쓰고 Node 스크립트에서만 돌아서 합치지 않았다.
// 맵이 추가되면 두 곳을 같이 봐야 한다.
const MAP_LABELS: Record<string, string> = {
  Baltic_Main: '에란겔',
  Erangel_Main: '에란겔',
  Desert_Main: '미라마',
  Savage_Main: '사녹',
  DihorOtok_Main: '비켄디',
  Summerland_Main: '카라킨',
  Range_Main: '캠프 자칼',
  Chimera_Main: '파라모',
  Heaven_Main: '헤이븐',
  Tiger_Main: '태이고',
  Kiki_Main: '데스턴',
  Neon_Main: '론도',
  Rondo_Main: '론도',
};

// 모르는 맵은 API 값을 그대로 보여준다. '-' 로 덮으면 새 맵이 나왔을 때
// 맵이 없는 경기와 구분이 안 된다.
export function mapLabel(mapName: string | null): string {
  if (!mapName) return '-';
  return MAP_LABELS[mapName] ?? mapName;
}
