import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { parseRosterFile, buildRosterEntries, type MemberForMatching } from '@/lib/scrimRoster';
import { formatRosterUploadMessage, sendDiscord } from '@/supabase/functions/_shared/notify.mjs';

// 디스코드 알림은 업로드의 곁다리다 — 웹훅이 없거나 전송이 실패해도 업로드
// 자체는 정상으로 돌려준다(폴링 버튼과 같은 규칙). 알림 때문에 명단이 안
// 올라간 것처럼 보이면 안 된다.
async function notifyUploadDone(entries: { discordUsername: string; discordNickname: string | null; matched: boolean }[]) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await sendDiscord(
      webhookUrl,
      formatRosterUploadMessage({
        totalCount: entries.length,
        matchedCount: entries.filter((entry) => entry.matched).length,
        missing: entries.filter((entry) => !entry.matched),
      }),
    );
  } catch {
    // 알림 실패는 조용히 넘긴다.
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseRosterFile(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: '파일에서 명단을 읽지 못했습니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .select('id')
    .limit(1)
    .single();
  if (clanError || !clanRow) {
    return NextResponse.json({ error: '클랜 정보를 찾지 못했습니다.' }, { status: 500 });
  }

  const { data: membersData, error: membersError } = await supabase
    .from('members')
    .select('id, discord_username, discord_nickname, tier')
    .not('discord_username', 'is', null);
  if (membersError) {
    return NextResponse.json({ error: '클랜원 명단을 불러오지 못했습니다.' }, { status: 500 });
  }

  const members: MemberForMatching[] = (membersData ?? []).map((m) => ({
    id: m.id,
    discordUsername: m.discord_username as string,
    discordNickname: m.discord_nickname as string | null,
    tier: m.tier as number,
  }));
  const entries = buildRosterEntries(rows, members);

  const { data: rosterRow, error: rosterError } = await supabase
    .from('scrim_rosters')
    .insert({ clan_id: clanRow.id })
    .select('id')
    .single();
  if (rosterError || !rosterRow) {
    return NextResponse.json({ error: '명단 저장에 실패했습니다.' }, { status: 500 });
  }

  const { error: entriesError } = await supabase.from('scrim_roster_entries').insert(
    entries.map((entry) => ({
      roster_id: rosterRow.id,
      discord_username: entry.discordUsername,
      discord_nickname: entry.discordNickname,
      member_id: entry.memberId,
      tier: entry.tier,
      tier_slot: entry.tierSlot,
      matched: entry.matched,
    })),
  );
  if (entriesError) {
    return NextResponse.json({ error: '명단 저장에 실패했습니다.' }, { status: 500 });
  }

  // 저장이 끝난 뒤에 부른다 — 저장이 실패한 명단을 "업로드 완료"라고 알리면 안 된다.
  await notifyUploadDone(entries);

  return NextResponse.json({
    ok: true,
    matchedCount: entries.filter((e) => e.matched).length,
    totalCount: entries.length,
  });
}
