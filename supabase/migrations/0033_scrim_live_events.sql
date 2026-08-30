-- 화면을 실시간으로 밀어주기 위한 신호 표.
--
-- 왜 matches / session_standings 를 직접 구독시키지 않나:
-- Realtime 의 postgres_changes 는 바뀐 행의 값을 그대로 브라우저로 보낸다.
-- 그런데 0004/0005 에서 raw_attributes·pubg_account_id 같은 칼럼을 anon 에게서
-- 일부러 막아뒀고(0028 의 session_standings 는 표 자체를 닫고 뷰로만 내보낸다),
-- 그 표들을 그대로 구독시키면 그 방침이 조용히 뚫린다. 그래서 "무엇이 언제
-- 바뀌었다"는 사실만 담은 표를 따로 두고, 화면은 이 신호를 받으면 평소 쓰던
-- API 로 다시 조회한다 — 권한 검사가 그대로 한 번 더 걸린다.
--
-- 트리거로 넣는 이유: 폴링 라우트뿐 아니라 scripts/poll-matches.mjs 로 넣어도
-- 똑같이 신호가 나가야 한다. 쓰는 쪽마다 "신호도 보내기"를 기억하게 만들면
-- 언젠가 한 곳이 빠진다.

create table if not exists scrim_live_events (
  id bigint generated always as identity primary key,
  scrim_date date not null,
  kind text not null,                      -- 'round' | 'standings'
  created_at timestamptz not null default now()
);

create index if not exists scrim_live_events_created_idx on scrim_live_events (created_at desc);

comment on table scrim_live_events is
  '화면 실시간 갱신용 신호. 값은 없고 "언제 무엇이 바뀌었다"만 담는다.';

alter table scrim_live_events enable row level security;

-- 신호에는 민감한 값이 없다. 열어둬야 Realtime 이 anon 구독을 허용한다.
drop policy if exists "scrim_live_events_select_public" on scrim_live_events;
create policy "scrim_live_events_select_public" on scrim_live_events for select using (true);

grant select (id, scrim_date, kind, created_at) on scrim_live_events to anon;
grant select (id, scrim_date, kind, created_at) on scrim_live_events to authenticated;

-- 새 매치가 들어오면 '라운드' 신호.
-- upsert 로 같은 매치를 다시 넣는 건 ON CONFLICT DO UPDATE 라 UPDATE 트리거가
-- 되므로 여기 안 걸린다 — 여러 번 폴링해도 신호가 중복되지 않는다.
create or replace function scrim_live_notify_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into scrim_live_events (scrim_date, kind)
  select s.scrim_date, 'round' from scrim_sessions s where s.id = new.scrim_session_id;
  return null;
end $$;

drop trigger if exists scrim_live_match_inserted on matches;
create trigger scrim_live_match_inserted
  after insert on matches for each row
  execute function scrim_live_notify_match();

-- 우승 확정은 1~16위를 한 번에 넣는다(0028). 행마다 신호를 보내면 64개가
-- 쏟아지므로, 문장 단위로 한 번만 보낸다.
create or replace function scrim_live_notify_standings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into scrim_live_events (scrim_date, kind)
  select distinct i.scrim_date, 'standings' from inserted i;
  return null;
end $$;

drop trigger if exists scrim_live_standings_inserted on session_standings;
create trigger scrim_live_standings_inserted
  after insert on session_standings
  referencing new table as inserted
  for each statement
  execute function scrim_live_notify_standings();

-- Realtime 이 이 표의 변경을 흘려보내도록 퍼블리케이션에 넣는다.
-- (이 프로젝트는 여태 아무 표도 넣지 않아 Realtime 을 쓴 적이 없다.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'scrim_live_events'
  ) then
    alter publication supabase_realtime add table scrim_live_events;
  end if;
end $$;
