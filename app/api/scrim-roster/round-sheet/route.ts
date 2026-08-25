import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buildRoundSheet } from '@/lib/roundSheetData';

export async function GET(request: Request) {
  const rosterId = new URL(request.url).searchParams.get('rosterId');
  if (!rosterId) {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  try {
    const sheet = await buildRoundSheet(getSupabaseServer(), rosterId);
    return NextResponse.json({
      roundCount: sheet.roundCount,
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
