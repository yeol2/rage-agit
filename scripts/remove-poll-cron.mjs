// 주2회 자동 폴링(pg_cron) 예약을 없앤다. 03 내전 시트의 수동 "폴링" 버튼이
// 같은 역할을 실시간으로 대신한다.
// 사용법: node scripts/remove-poll-cron.mjs

import { connectPostgres } from './lib/db.mjs';
import { loadEnvLocal } from './lib/env.mjs';

loadEnvLocal();

const JOB_NAME = 'poll-matches';
const client = await connectPostgres();

try {
  const existing = await client.query('select jobid from cron.job where jobname = $1', [JOB_NAME]);
  if (existing.rows.length === 0) {
    console.log(`예약 '${JOB_NAME}' 이 이미 없다 — 할 일 없음.`);
  } else {
    await client.query('select cron.unschedule($1)', [JOB_NAME]);
    console.log(`예약 '${JOB_NAME}' 제거 완료.`);
  }
} finally {
  await client.end();
}
