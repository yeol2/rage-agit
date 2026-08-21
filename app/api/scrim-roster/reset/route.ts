import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// 03 내전 시트 아래 "초기화" 버튼 — 내전이 끝나고 이 페이지를 다음 내전에
// 다시 쓰려고 01 명단 업로드 이전 상태로 되돌린다. scrim_rosters 를 전부
// 지우면(cascade로 scrim_roster_entries 도 같이 지워진다) fetchLatestRoster()가
// null을 돌려줘 01이 "아직 업로드된 명단이 없습니다" 화면으로 돌아간다.
//
// matches/match_participants(실제 PUBG 경기 기록, 리더보드가 쓰는 데이터)는
// 건드리지 않는다 — 이 버튼은 team-builder 화면의 계획 상태만 초기화한다.
export async function DELETE() {
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from('scrim_rosters')
    .delete()
    .not('id', 'is', null); // delete()에 조건이 없으면 supabase-js 가 거부한다

  if (error) {
    return NextResponse.json({ error: `초기화에 실패했습니다: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
