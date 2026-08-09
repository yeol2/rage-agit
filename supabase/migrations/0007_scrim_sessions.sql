-- 같은 날 매치들을 하나의 '내전'으로 묶는다.
--
-- 묶는 기준은 한국시간 날짜다. 내전이 한국시간 저녁 8시~9시 40분에 열리므로
-- UTC 날짜로 묶으면 사람이 부르는 날짜와 어긋날 수 있다.

create table if not exists scrim_sessions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id),
  scrim_date date not null,              -- 한국시간 기준 날짜
  title text not null,                   -- '2026-08-09 (일) 내전'
  session_number integer,                -- 비워둔다. 과거 내전을 넣은 뒤 채운다
  replay_url text,                       -- 관리자가 넣는다. API 에 없다
  created_at timestamptz not null default now(),
  unique (clan_id, scrim_date)
);

alter table matches add column if not exists scrim_session_id uuid references scrim_sessions(id);
create index if not exists matches_session_idx on matches (scrim_session_id);

-- 이동거리는 raw_stats 안에만 있는데 그건 공개 읽기에서 막혀 있다.
-- 화면에 보여주려면 컬럼으로 빼야 한다.
-- dak.gg 의 '이동 거리' 는 walkDistance + rideDistance 다 (실측 6472m = 6.47km).
alter table match_participants add column if not exists walk_distance numeric;
alter table match_participants add column if not exists ride_distance numeric;

-- 경기 수와 참가 인원은 저장하지 않고 유도한다.
-- 하루 4경기가 항상 한 번의 폴링에 다 들어오지 않는다(08-09 에 실제로 3경기만
-- 먼저 들어왔다). 저장해두면 뒤늦게 붙을 때마다 다시 세야 하고, 한 번 빠뜨리면
-- 조용히 틀린 값이 남는다.
create or replace view scrim_session_summary as
select s.id,
       s.clan_id,
       s.scrim_date,
       s.title,
       s.session_number,
       s.replay_url,
       count(distinct m.pubg_match_id) as match_count,
       count(distinct p.pubg_account_id) as participant_count,
       min(m.played_at) as started_at
from scrim_sessions s
left join matches m on m.scrim_session_id = s.id
left join match_participants p on p.pubg_match_id = m.pubg_match_id
group by s.id;

alter table scrim_sessions enable row level security;

drop policy if exists "scrim_sessions_select_public" on scrim_sessions;
create policy "scrim_sessions_select_public" on scrim_sessions for select using (true);

-- 0004 방침대로 공개할 컬럼만 명시적으로 연다.
revoke select on scrim_sessions from anon;
revoke select on scrim_sessions from authenticated;
grant select (id, clan_id, scrim_date, title, session_number, replay_url, created_at)
  on scrim_sessions to anon;
grant select (id, clan_id, scrim_date, title, session_number, replay_url, created_at)
  on scrim_sessions to authenticated;

grant select on scrim_session_summary to anon;
grant select on scrim_session_summary to authenticated;

-- matches 와 match_participants 에 새로 생긴 컬럼도 명시적으로 연다.
-- 0005 에서 컬럼 단위로 잠갔기 때문에 새 컬럼은 기본적으로 안 읽힌다.
grant select (scrim_session_id) on matches to anon;
grant select (scrim_session_id) on matches to authenticated;
grant select (walk_distance, ride_distance) on match_participants to anon;
grant select (walk_distance, ride_distance) on match_participants to authenticated;
