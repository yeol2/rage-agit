// 목·일 내전 자동 폴링 + 자동 확정 예약(pg_cron)을 만들거나 갱신한다.
// 사용법: node scripts/setup-scrim-cron.mjs [cron표현식] [사이트주소]
//   기본값: '*/5 11-13 * * 0,4'  (UTC 11:00~13:55 목·일 = 한국시간 20:00~22:55, 5분마다)
//           https://www.rageclan.site
//   예약 지우기: node scripts/setup-scrim-cron.mjs --remove
//
// pg_cron 이 pg_net 으로 운영 사이트의 /api/cron/scrim-auto 를 부른다. Vercel Cron 을
// 안 쓰는 건 Hobby 요금제가 하루 1회만 허용해서다.
//
// 호출 헤더에 service_role 키가 필요한데, 이걸 SQL 에 적으면 cron.job 에 평문으로
// 남는다. 그래서 Vault 에 저장하고 예약에서는 이름으로 참조한다(8월 Edge Function
// 크론 때 만든 poll_matches_service_key 를 그대로 쓴다). 값은 절대 출력하지 않는다.
//
// 요청 한도: 오늘 명단이 없거나 이미 확정됐으면 라우트가 PUBG 를 안 부른다. 부를
// 때도 Players 1회라 5분 간격 = 분당 0.2회로 PUBG 한도(분당 10회)의 2% 다.

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [serviceRoleKey] = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const JOB_NAME = 'scrim-auto-poll';
const SECRET_NAME = 'poll_matches_service_key';
const remove = process.argv[2] === '--remove';
const schedule = (!remove && process.argv[2]) || '*/5 11-13 * * 0,4';
const siteUrl = process.argv[3] ?? 'https://www.rageclan.site';

const client = await connectPostgres();

try {
  // 같은 이름의 예약이 있으면 지우고 다시 만든다 (멱등).
  await client.query('select cron.unschedule(jobid) from cron.job where jobname = $1', [JOB_NAME]);
  if (remove) {
    console.log(`예약 ${JOB_NAME} 를 지웠다.`);
  } else {
    const existing = await client.query('select id from vault.secrets where name = $1', [SECRET_NAME]);
    if (existing.rows.length > 0) {
      await client.query('select vault.update_secret($1, $2, $3)', [
        existing.rows[0].id,
        serviceRoleKey,
        SECRET_NAME,
      ]);
    } else {
      await client.query('select vault.create_secret($1, $2)', [serviceRoleKey, SECRET_NAME]);
    }
    console.log(`Vault 에 ${SECRET_NAME} 저장됨`);

    // 예약이 실행할 SQL. 비밀값은 여기 없다 — Vault 에서 이름으로 꺼내 쓴다.
    // 폴링이 길어질 수 있어 pg_net 기본 타임아웃(5초)을 60초로 늘린다.
    const command = `select net.http_post(
      url := '${siteUrl}/api/cron/scrim-auto',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${SECRET_NAME}')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )`;

    await client.query('select cron.schedule($1, $2, $3)', [JOB_NAME, schedule, command]);

    const { rows } = await client.query(
      'select jobname, schedule, active from cron.job where jobname = $1',
      [JOB_NAME],
    );
    console.log(`예약됨: ${rows[0].jobname}  ${rows[0].schedule}  active=${rows[0].active}`);
    console.log('한국시간 기준으로는 UTC 시각에 9시간을 더한 때에 실행된다.');
  }
} catch (error) {
  console.error(`예약 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
