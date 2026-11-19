'use client';

import { useEffect, useState } from 'react';
import type { ReactionRankEntry } from '@/lib/reaction';
import { ReactionGame } from './ReactionGame';
import { ReactionRanking } from './ReactionRanking';

// 위에 테스트(경기장은 화면 끝까지 넓게), 그 아래 랭킹(2026-11-16 사용자 요청 — 원래는 오른쪽).
// 등록하면 서버가 돌려준 최신 랭킹으로 바로 바꾸고 내 줄을 표시한다.
// 테스트 진행 상태는 전부 이 브라우저 안에만 있다 — 다른 사람 화면과 섞일 일이 없다.
//
// 랭킹은 페이지를 그릴 때가 아니라 브라우저에서 /api/reaction 으로 받는다(2026-11-19). 페이지는 1시간마다
// 한 번만 그려지고, 랭킹 응답은 CDN 이 15초씩 들고 있어서 접속이 몰려도 서버 계산(CPU)이 거의 안 든다.
export function ReactionPlayground() {
  const [ranking, setRanking] = useState<ReactionRankEntry[] | null>(null);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/reaction')
      .then((response) => response.json())
      .then((data) => {
        // 그사이 내가 등록해서 더 새 랭킹을 받았으면 덮지 않는다.
        if (alive && Array.isArray(data.ranking)) setRanking((current) => current ?? data.ranking);
      })
      .catch(() => {
        if (alive) setRanking((current) => current ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

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
