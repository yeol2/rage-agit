import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buildRoundSheet, latestScrimDate } from '@/lib/roundSheetData';

// 01 내전 시트. 날짜 하나로만 만든다 — 로스터와 무관하다(그래서 "초기화"로
// 명단을 지워도 지난 시트는 그대로 보인다).
//
// scrimDate 를 안 주면 가장 최근에 매치가 잡힌 내전을 보여준다. 내전이 시작돼
// 첫 라운드가 들어오는 순간 그날이 "가장 최근"이 되므로, 준비 중에는 지난
// 내전을 보다가 저절로 오늘로 넘어간다.
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('scrimDate');

  try {
    const supabase = getSupabaseServer();
    const scrimDate = requested ?? (await latestScrimDate(supabase));

    // 내전이 한 번도 치러진 적이 없는 경우.
    if (!scrimDate) {
      return NextResponse.json({ scrimDate: null, roundCount: 0, teams: [], unstableTeamPlayers: [] });
    }

    const sheet = await buildRoundSheet(supabase, scrimDate);
    return NextResponse.json({
      // 어느 날짜를 그린 건지 화면이 표시해야 한다 — 준비 중에는 지난 내전이
      // 보이므로, 날짜가 없으면 오늘 것으로 오해하게 된다.
      scrimDate,
      roundCount: sheet.roundCount,
      unstableTeamPlayers: sheet.unstableTeamPlayers,
      // memberIds 는 우승 확정(confirm-win)이 서버에서 쓰는 값이라 내보내지 않는다.
      teams: sheet.teams.map(({ memberIds: _memberIds, ...team }) => team),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '시트를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
