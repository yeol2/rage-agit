// pg_cron 예약을 만들거나 갱신한다.
// 사용법: node scripts/setup-cron.mjs [cron표현식]
//   기본값: '0 14 * * 0,4'  (UTC 14:00 목·일 = 한국시간 23:00)
//
// 호출 헤더에 service_role 키가 필요한데, 이걸 SQL 파일에 적으면 저장소에
// 비밀값이 들어간다. 그래서 Vault 에 저장하고 예약에서는 이름으로 참조한다.

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');

const schedule = process.argv[2] ?? '0 14 * * 0,4';
const functionUrl = `${url}/functions/v1/poll-matches`;
const JOB_NAME = 'poll-matches';
const SECRET_NAME = 'poll_matches_service_key';

const client = await connectPostgres();

try {
  // Vault 에 키를 넣는다 (이미 있으면 갱신).
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

  // 같은 이름의 예약이 있으면 지우고 다시 만든다 (멱등).
  await client.query('select cron.unschedule(jobid) from cron.job where jobname = $1', [JOB_NAME]);

  // 예약이 실행할 SQL. 비밀값은 여기 없다 — Vault 에서 이름으로 꺼내 쓴다.
  const command = `select net.http_post(
    url := '${functionUrl}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${SECRET_NAME}')
    ),
    body := jsonb_build_object('trigger', 'cron')
  )`;

  await client.query('select cron.schedule($1, $2, $3)', [JOB_NAME, schedule, command]);

  const { rows } = await client.query(
    'select jobname, schedule, active from cron.job where jobname = $1',
    [JOB_NAME],
  );
  console.log(`예약됨: ${rows[0].jobname}  ${rows[0].schedule}  active=${rows[0].active}`);
  console.log('한국시간 기준으로는 UTC 시각에 9시간을 더한 때에 실행된다.');
} catch (error) {
  console.error(`예약 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
