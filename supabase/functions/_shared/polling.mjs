// 매치 폴링 파이프라인. Node 스크립트와 Deno Edge Function 이 함께 쓴다.
// 그래서 런타임 전용 API(process, Deno, node:fs)를 쓰지 않는다 —
// 필요한 것은 전부 인자로 받는다.

export function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// 씨앗은 "내전에 자주 나오면서 랭크는 적게 하는 사람"이 좋다.
// 실측: 내전 참가 상위 20명 전원이 10경기에 다 나왔지만, 14일간 총 경기 수는
// 39건에서 279건까지 7배 차이났다. 씨앗으로서의 가치는 같은데 열어봐야 할
// 매치 수는 그만큼 차이나므로, 참가 기록으로 후보를 좁힌 뒤 가벼운 쪽을 고른다.
//
// 매치 목록 길이는 Players 응답에 이미 들어 있어 추가 호출이 필요 없다.
export function pickLightSeeds(players, limit) {
  return players
    .map((p) => ({
      accountId: p.id,
      matchCount: p.relationships?.matches?.data?.length ?? 0,
    }))
    .sort((a, b) => a.matchCount - b.matchCount)
    .slice(0, limit)
    .map((p) => p.accountId);
}
