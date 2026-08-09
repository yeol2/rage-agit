// 매치 폴링 Edge Function.
// pg_cron 이 매주 목·일 한국시간 23:00(UTC 14:00)에 부른다.
//
// 폴링 로직은 로컬 스크립트와 같은 파일을 쓴다 — _shared/polling.mjs.
// 여기서는 HTTP 요청을 받고, 실행 기록을 남기고, 결과를 알리는 것만 한다.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runPolling } from '../_shared/polling.mjs';
import { formatFailureMessage, formatPollingMessage, sendDiscord } from '../_shared/notify.mjs';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // 본문이 없어도 기본값으로 돈다
  }

  const trigger = typeof body.trigger === 'string' ? body.trigger : 'manual';
  const sinceHours = typeof body.sinceHours === 'number' ? body.sinceHours : 24;
  const maxMatches = typeof body.maxMatches === 'number' ? body.maxMatches : 200;

  const { data: run } = await supabase
    .from('polling_runs')
    .insert({ trigger, since_hours: sinceHours })
    .select('id')
    .single();

  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');

  try {
    const result = await runPolling({
      supabase,
      apiKey: Deno.env.get('PUBG_API_KEY')!,
      sinceHours,
      maxMatches,
      playerRetries: 1, // 실행 시간 제한이 있어 한 번만 재시도한다
      log: (message: string) => console.log(message),
    });

    await supabase
      .from('polling_runs')
      .update({
        finished_at: new Date().toISOString(),
        seeds_used: result.seedsUsed,
        matches_examined: result.matchesExamined,
        scrims_found: result.scrimsFound,
        succeeded: true,
      })
      .eq('id', run!.id);

    const message = formatPollingMessage(result, { sinceHours });
    if (message && webhookUrl) await sendDiscord(webhookUrl, message);

    return new Response(
      JSON.stringify({
        ok: true,
        seedsUsed: result.seedsUsed,
        matchesExamined: result.matchesExamined,
        scrimsFound: result.scrimsFound,
        unregistered: [...result.unregistered.keys()],
        truncated: result.truncated,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const err = error as Error;
    console.error(err.message);

    await supabase
      .from('polling_runs')
      .update({
        finished_at: new Date().toISOString(),
        succeeded: false,
        error_message: err.message,
      })
      .eq('id', run!.id);

    // 실패를 조용히 넘기면 자동화가 오히려 유실을 늦게 발견하게 만든다.
    if (webhookUrl) {
      await sendDiscord(webhookUrl, formatFailureMessage(err, { sinceHours })).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
