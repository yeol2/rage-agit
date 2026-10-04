import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { assignTeamNumbers, type TeamAssignmentInput } from '@/lib/scrimRoster';
import { fetchRageScoreMap } from '@/lib/rageScoreMap';
import { cleanDisplayName, stripTrailingKoreanTag } from '@/lib/memberStats';
import { formatTeamSheetMessages, sendDiscord } from '@/supabase/functions/_shared/notify.mjs';

const TIER_SLOTS = [1, 2, 3, 4] as const;

// components/team-builder/RosterBoard.tsx 의 targetPerTierFor() 와 같은 규칙이다
// (참가 인원을 4로 나눈 반올림값). 화면이 이미 "팀 구성" 버튼을 그 규칙으로
// 활성화/비활성화하지만, 그 사이 명단이 바뀌었을 수 있어 서버에서 다시 검증한다.
function targetPerTierFor(totalCount: number): number {
  return totalCount > 0 ? Math.round(totalCount / 4) : 16;
}

// 엑셀 시트에는 클랜 접두사 없이 적으므로 "Ez_XXXX" 에서 "XXXX" 만 남긴다
// (03 시트의 RoundSheet cleanName() 과 같은 규칙).
function sheetName(discordNickname: string | null): string {
  if (!discordNickname) return '';
  return stripTrailingKoreanTag(cleanDisplayName(discordNickname)).replace(/^ez_/i, '');
}

// 팀 × 티어 격자를 만들어 디스코드로 보낸다 —
// 관리자가 그대로 복사해 엑셀 내전 시트에 붙여넣는다. 알림은 곁다리라 웹훅이
// 없거나 실패해도 팀 구성 자체는 성공으로 돌려준다(업로드·폴링과 같은 규칙).
async function notifyTeamSheet(
  rows: { discord_nickname: string | null; tier_slot: number | null; team_number: number | null }[],
  teamCount: number,
) {
  // 팀 구성 표는 운영진이 같이 보는 채널로 따로 보낸다. 다른 알림(업로드·폴링)이
  // 가는 DISCORD_WEBHOOK_URL 은 운영자 개인 채널이라, 전용 주소가 없을 때만 그리로 보낸다.
  const webhookUrl = process.env.DISCORD_TEAM_SHEET_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const teams = Array.from({ length: teamCount }, () => ['', '', '', '']);
  for (const row of rows) {
    if (row.team_number === null || row.tier_slot === null) continue;
    teams[row.team_number - 1][row.tier_slot - 1] = sheetName(row.discord_nickname);
  }

  try {
    // 순서가 중요하다(안내가 위, 표가 아래) — 동시에 보내지 않고 차례로 보낸다.
    for (const content of formatTeamSheetMessages({ teams })) {
      await sendDiscord(webhookUrl, content);
    }
  } catch {
    // 알림 실패는 조용히 넘긴다.
  }
}

// "팀 구성" 버튼을 누르면 호출된다 — 02 티어 테이블에 보이는 순서 그대로 팀
// 번호를 계산해 저장하고, 갱신된 전체 명단을 돌려준다(클라이언트가 재조회 없이
// 03 표를 바로 채울 수 있게).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rosterId = body?.rosterId;
  if (typeof rosterId !== 'string') {
    return NextResponse.json({ error: 'rosterId 가 필요합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: rows, error: fetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, member_id, tier, tier_slot')
    .eq('roster_id', rosterId)
    // 화면(fetchLatestRoster)과 같은 기준 — 티어·점수까지 같을 때의 순서를 맞춘다.
    .order('id', { ascending: true });
  if (fetchError) {
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  const entries: TeamAssignmentInput[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    memberId: row.member_id as string | null,
    tier: row.tier as number | null,
    tierSlot: row.tier_slot as 1 | 2 | 3 | 4 | null,
  }));

  const targetPerTier = targetPerTierFor(entries.length);
  const allTiersFull = TIER_SLOTS.every(
    (slot) => entries.filter((entry) => entry.tierSlot === slot).length === targetPerTier,
  );
  if (entries.length === 0 || !allTiersFull) {
    return NextResponse.json(
      { error: '1~4티어가 모두 정확히 채워져야 팀을 구성할 수 있습니다.' },
      { status: 400 },
    );
  }

  // 같은 티어 안에서는 점수 높은 사람이 앞 번호 팀으로 간다(01 화면 순서와 같다).
  // 점수를 못 불러와도 팀 구성은 막지 않는다 — 그때는 티어 순서만으로 매긴다.
  const scores = await fetchRageScoreMap('recent16').catch(() => ({}));
  const teamNumberById = assignTeamNumbers(entries, scores);

  // 팀 번호를 다시 매길 때마다 고정은 항상 해제된 상태로 되돌린다 — 이전에
  // 눌렀던 "팀 구성"에서 고정해둔 자리가 새 배치에도 그대로 남아있으면 안 된다.
  //
  // 64개를 한 번에 바꾸는 SQL 문 하나로 묶는다(0030) — 개별 요청 64개를 동시에
  // 날리던 예전 방식은 그중 하나만 실패해도 나머지는 이미 커밋돼버려서, 03 표에
  // 그 한 자리만 빈 칸으로 남는 문제가 있었다.
  const { error: updateError } = await supabase.rpc('apply_team_number_updates', {
    updates: Array.from(teamNumberById.entries()).map(([id, teamNumber]) => ({ id, teamNumber })),
    reset_fixed: true,
  });
  if (updateError) {
    return NextResponse.json({ error: '팀 번호 저장에 실패했습니다.' }, { status: 500 });
  }

  // 정렬을 명시하지 않으면 Postgres 가 행을 어떤 순서로 돌려줄지는 보장이 없다 —
  // 방금처럼 여러 행을 UPDATE 한 직후라면 특히 더 그렇다. 정렬 없이 받은 순서를
  // 그대로 쓰면(02 화면은 같은 티어 안에서 이 배열 순서로 동점자를 나열한다) 같은
  // 상태를 봐도 사람마다, 누를 때마다 카드 줄이 달라 보인다.
  const { data: updatedRows, error: refetchError } = await supabase
    .from('scrim_roster_entries')
    .select('id, discord_nickname, member_id, tier, tier_slot, matched, team_number, fixed, members(vip_rank)')
    .eq('roster_id', rosterId)
    .order('id', { ascending: true });
  if (refetchError || !updatedRows) {
    return NextResponse.json({ error: '갱신된 명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  await notifyTeamSheet(updatedRows, targetPerTier);

  return NextResponse.json({
    entries: updatedRows.map((row) => ({
      id: row.id,
      discordNickname: row.discord_nickname,
      memberId: row.member_id,
      tier: row.tier,
      tierSlot: row.tier_slot,
      matched: row.matched,
      teamNumber: row.team_number,
      fixed: row.fixed,
      vipRank: (Array.isArray(row.members) ? row.members[0] : row.members)?.vip_rank ?? null,
    })),
  });
}
