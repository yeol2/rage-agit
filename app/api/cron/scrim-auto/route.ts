import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { pollScrim } from '@/lib/scrimPoll';
import { confirmScrimWin, REQUIRED_ROUNDS } from '@/lib/scrimConfirm';
import { formatAutoConfirmMessage, sendDiscord } from '@/supabase/functions/_shared/notify.mjs';
import { toKstDate } from '@/supabase/functions/_shared/sessions.mjs';

// 폴링이 PUBG 에서 매치 상세를 여러 건 열 수 있다 — 기본 10초로는 빠듯하다.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * 목·일 내전 자동 폴링 + 자동 확정.
 *
 * Supabase pg_cron 이 내전 날 밤(KST 20:00~00:55) 5분마다 pg_net 으로 이 라우트를
 * 부른다(scripts/setup-scrim-cron.mjs). Vercel Cron 을 안 쓰는 건 Hobby 요금제가
 * 하루 1회만 허용해서다.
 *
 * 한 번 불릴 때:
 *   1. 오늘(KST) 올린 명단이 없으면 — 내전이 없는 날이다 — PUBG 를 부르지 않고 끝낸다.
 *   2. 오늘 내전이 이미 확정됐으면(버튼이든 이전 크론이든) 역시 바로 끝낸다.
 *   3. 아니면 03 시트의 "폴링" 버튼과 같은 폴링을 한 번 돌린다 — Players 호출 1회.
 *      5분 간격이면 분당 0.2회로 PUBG 한도(분당 10회)의 2% 다.
 *   4. 4경기가 다 찼으면 "우승 확정"과 같은 저장을 하고(저티어 여부는 명단에 저장된
 *      토글 값) 결과를 디스코드로 보낸다. 미연결 참가자가 있어도 확정한다 —
 *      미연결 명단은 폴링이 4번째 경기를 잡는 순간 따로 알리고, 정리 뒤 버튼으로
 *      다시 확정하면 덮어쓴다. 등수 스냅샷은 명단당 한 번만 찍혀서 안전하다.
 */

function authorized(request: Request): boolean {
  // 새 비밀값을 Vercel 에 따로 넣지 않으려고 이미 양쪽(Vercel 환경변수, Supabase
  // Vault)에 있는 service_role 키를 쓴다 — 예전 Edge Function 크론과 같은 방식이다.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** 한국시간 오늘 0시의 실제 시각(UTC ISO). 오늘 올린 명단을 찾는 기준이다. */
function kstMidnightIso(now: Date): string {
  const [y, m, d] = toKstDate(now.toISOString()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 9 * 3600 * 1000).toISOString();
}

async function todaysRoster(supabase: SupabaseClient, now: Date) {
  const { data } = await supabase
    .from('scrim_rosters')
    .select('id, fetched_at, low_tier')
    .gte('fetched_at', kstMidnightIso(now))
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; fetched_at: string; low_tier: boolean | null } | null;
}

async function alreadyConfirmed(supabase: SupabaseClient, scrimDate: string): Promise<boolean> {
  const { data } = await supabase
    .from('session_standings')
    .select('scrim_date')
    .eq('scrim_date', scrimDate)
    .eq('session_number', 1)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// 크론이 실제로 돌았다는 증거는 이 표에 남긴다(cron.job_run_details 는 pg_net 호출이
// "보냈다"까지만 안다). 기록 실패가 폴링을 막으면 안 되므로 조용히 넘긴다.
async function recordRun(
  supabase: SupabaseClient,
  row: {
    startedAt: string;
    sinceHours: number;
    seedsUsed?: number;
    matchesExamined?: number;
    scrimsFound?: number;
    succeeded: boolean;
    errorMessage?: string;
  },
) {
  await supabase
    .from('polling_runs')
    .insert({
      started_at: row.startedAt,
      finished_at: new Date().toISOString(),
      trigger: 'cron',
      since_hours: Math.round(row.sinceHours),
      seeds_used: row.seedsUsed ?? null,
      matches_examined: row.matchesExamined ?? null,
      scrims_found: row.scrimsFound ?? null,
      succeeded: row.succeeded,
      error_message: row.errorMessage ?? null,
    })
    .then(
      () => null,
      () => null,
    );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PUBG_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  const supabase = getSupabaseServer();
  const now = new Date();
  const today = toKstDate(now.toISOString());

  const roster = await todaysRoster(supabase, now);
  if (!roster) return NextResponse.json({ status: 'no-roster', today });

  // 명단을 올린 저녁이 곧 그 내전이다(lib/scrimPoll 의 rosterFetchedAt 참고).
  const scrimDate = toKstDate(roster.fetched_at);
  if (await alreadyConfirmed(supabase, scrimDate)) {
    return NextResponse.json({ status: 'already-confirmed', scrimDate });
  }

  const startedAt = now.toISOString();
  let poll;
  try {
    poll = await pollScrim(supabase, { apiKey, rosterId: roster.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '폴링에 실패했습니다.';
    await recordRun(supabase, { startedAt, sinceHours: 0, succeeded: false, errorMessage: message });
    return NextResponse.json({ status: 'poll-failed', error: message }, { status: 500 });
  }
  await recordRun(supabase, {
    startedAt,
    sinceHours: poll.sinceHours,
    seedsUsed: poll.seedsUsed,
    matchesExamined: poll.matchesExamined,
    scrimsFound: poll.scrimsFound,
    succeeded: true,
  });

  // 폴링이 오늘 명단과 다른 날짜의 매치를 잡았으면(자정 넘어 끝난 경기 등) 그
  // 날짜로 센 라운드는 오늘 내전 것이 아니다 — 확정하지 않는다.
  if (poll.scrimDate !== scrimDate || poll.roundCount < REQUIRED_ROUNDS) {
    return NextResponse.json({
      status: 'waiting',
      scrimDate,
      roundCount: poll.scrimDate === scrimDate ? poll.roundCount : 0,
      found: poll.found,
    });
  }

  const result = await confirmScrimWin(supabase, {
    scrimDate,
    rosterId: roster.id,
    lowTier: roster.low_tier === true,
  });
  if (!result.ok) {
    return NextResponse.json({ status: 'confirm-failed', error: result.error }, { status: result.status });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    await sendDiscord(
      webhookUrl,
      formatAutoConfirmMessage({
        scrimDate: result.scrimDate,
        confirmedAt: new Date().toISOString(),
        lowTier: result.lowTier,
        teams: result.teams,
        savedTeams: result.savedTeams,
        savedMembers: result.savedMembers,
      }),
    ).catch(() => null);
  }

  return NextResponse.json({
    status: 'confirmed',
    scrimDate: result.scrimDate,
    teamNumber: result.teamNumber,
    savedMembers: result.savedMembers,
  });
}
