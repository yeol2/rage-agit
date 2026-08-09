-- 폴링 자동화: 스케줄러(pg_cron), HTTP 호출(pg_net), 실행 기록.
--
-- 예약 자체는 여기서 만들지 않는다 — 호출 헤더에 service_role 키가 들어가야 해서
-- SQL 파일에 적으면 비밀값이 저장소에 들어간다. 예약은 scripts/setup-cron.mjs 가
-- Vault 에서 키를 꺼내 만든다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists polling_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null,              -- 'cron' | 'manual'
  since_hours integer not null,       -- 얼마나 되돌아봤는지
  seeds_used integer,
  matches_examined integer,
  scrims_found integer,
  succeeded boolean,
  error_message text
);

create index if not exists polling_runs_started_idx on polling_runs (started_at desc);

alter table polling_runs enable row level security;

-- 내부 운영 기록이라 공개 읽기 정책을 만들지 않는다.
-- 0004 에서 정한 방침대로 명시적으로 닫아둔다.
revoke select on polling_runs from anon;
revoke select on polling_runs from authenticated;
