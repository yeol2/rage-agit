import { NextResponse } from 'next/server';
import { type RankingWindow } from '@/lib/rankingStats';
import { fetchRageScoreMap } from '@/lib/rageScoreMap';

// team-builder "01 티어 테이블"이 관리자 전용 종합점수 배지를 그리는 데 쓴다.
// RosterBoard는 다른 데이터를 전부 REST 라우트로만 받으므로(브라우저에서
// Supabase를 직접 안 부름), 여기서도 같은 패턴을 따른다.
export async function GET(request: Request) {
  const windowParam = new URL(request.url).searchParams.get('window');
  const window: RankingWindow = windowParam === 'alltime' ? 'alltime' : 'recent16';

  try {
    return NextResponse.json({ scores: await fetchRageScoreMap(window) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '점수를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
