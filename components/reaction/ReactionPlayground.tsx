'use client';

import { useState } from 'react';
import type { ReactionRankEntry } from '@/lib/reaction';
import { ReactionGame } from './ReactionGame';
import { ReactionRanking } from './ReactionRanking';

// 왼쪽 테스트 + 오른쪽 랭킹. 등록하면 서버가 돌려준 최신 랭킹으로 바로 바꾸고 내 줄을 표시한다.
// 테스트 진행 상태는 전부 이 브라우저 안에만 있다 — 다른 사람 화면과 섞일 일이 없다.
export function ReactionPlayground({ initialRanking }: { initialRanking: ReactionRankEntry[] }) {
  const [ranking, setRanking] = useState(initialRanking);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
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
