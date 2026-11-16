'use client';

import { useState } from 'react';
import type { ReactionRankEntry } from '@/lib/reaction';
import { ReactionGame } from './ReactionGame';
import { ReactionRanking } from './ReactionRanking';

// 위에 테스트(경기장은 화면 끝까지 넓게), 그 아래 랭킹(2026-11-16 사용자 요청 — 원래는 오른쪽).
// 등록하면 서버가 돌려준 최신 랭킹으로 바로 바꾸고 내 줄을 표시한다.
// 테스트 진행 상태는 전부 이 브라우저 안에만 있다 — 다른 사람 화면과 섞일 일이 없다.
export function ReactionPlayground({ initialRanking }: { initialRanking: ReactionRankEntry[] }) {
  const [ranking, setRanking] = useState(initialRanking);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <ReactionGame
        onRegistered={(nextRanking, memberId) => {
          setRanking(nextRanking);
          setMyMemberId(memberId);
        }}
      />
      <ReactionRanking ranking={ranking} highlightMemberId={myMemberId} />
    </div>
  );
}
