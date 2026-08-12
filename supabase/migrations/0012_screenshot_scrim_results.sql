-- 디스코드 스크린샷에서 읽은 과거 내전 결과를 받는다.
--
-- PUBG API 는 14일, dak.gg 는 6월 중순까지만 거슬러 올라간다. 그보다 이전
-- (2026-02 ~ 05) 내전은 디스코드에 올라온 결과 스크린샷밖에 남아 있지 않다.
--
-- 스크린샷은 match_participants 가 요구하는 것보다 훨씬 빈약하다 — 킬과 팀등수뿐이고
-- 데미지·어시·헤드샷·생존시간이 아예 없다. 그래서 match_participants 의 NOT NULL 을
-- 푸는 대신 별도 테이블로 받는다. 그렇게 해야 6각형 지표(member_recent_stats)가
-- 계속 '데미지까지 다 있는 경기'만 보게 된다 — 빈 칸이 섞인 경기가 최근 10경기에
-- 끼어들면 지표가 조용히 흐려진다.
--
-- 랭킹 포디움만 두 출처를 합쳐 본다 (member_ranking_games).

-- 0011 에서 세 군데에 흩어질 뻔한 배치 점수표를 한 곳에 모은다.
-- 점수표가 바뀌면 여기만 고치면 된다.
create or replace function placement_points(team_rank integer)
returns integer
language sql
immutable
as $$
  select case
    when team_rank = 1 then 10
    when team_rank = 2 then 6
    when team_rank = 3 then 5
    when team_rank = 4 then 4
    when team_rank = 5 then 3
    when team_rank = 6 then 2
    when team_rank in (7, 8) then 1
    else 0
  end;
$$;

create table if not exists scrim_screenshot_results (
  id uuid primary key default gen_random_uuid(),
  scrim_date date not null,            -- 한국시간 기준 날짜 (0007 과 같은 기준)
  round_no integer not null,           -- 그날의 몇 번째 매치인가 (1~4)
  team_no integer not null,            -- 스크린샷에 적힌 팀 번호. 추적용
  team_rank integer not null,          -- 그 매치의 팀 등수 (1~16)
  pubg_ign text not null,              -- 스크린샷에 찍힌 닉네임 (Ez_ 접두사 포함)
  member_id uuid references members(id), -- 못 찾으면 NULL (탈퇴자/게스트)
  kills integer not null,
  source_file text,                    -- 어느 이미지에서 읽었는지
  created_at timestamptz not null default now(),
  unique (scrim_date, round_no, pubg_ign)
);

create index if not exists scrim_screenshot_results_member_idx
  on scrim_screenshot_results (member_id);

alter table scrim_screenshot_results enable row level security;

-- 뷰는 소유자 권한으로 도는 덕에 anon 이 이 테이블을 직접 읽을 필요가 없다.
-- match_participants 도 같은 방식이다 (0005).

-- 랭킹이 보는 '한 사람의 경기 한 판' 목록. 두 출처를 세로로 잇는다.
-- 랭킹은 킬과 팀등수만 쓰므로 스크린샷 출처에 없는 칸은 애초에 필요 없다.
create or replace view member_ranking_games as
select
  p.member_id,
  p.kills,
  p.team_rank,
  m.played_at
from match_participants p
join matches m using (pubg_match_id)
where p.member_id is not null
union all
select
  r.member_id,
  r.kills,
  r.team_rank,
  -- dak.gg 백필(0008)과 같은 자리표시자 규칙: 그날 20시대, 라운드 순서대로.
  -- 실제 경기 시각은 스크린샷에 없다. '최근 10경기' 정렬에만 쓴다.
  (r.scrim_date::text || 'T20:' || lpad(r.round_no::text, 2, '0') || ':00+09:00')::timestamptz
from scrim_screenshot_results r
where r.member_id is not null;

-- 통산 랭킹. 0011 의 member_alltime_stats 를 두 출처 기준으로 다시 만든다.
-- 데미지·헤드샷 같은 칸은 뺀다 — 스크린샷 출처에는 없고, 랭킹도 쓰지 않는다.
drop view if exists member_alltime_stats;
create view member_alltime_stats as
select
  g.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(g.kills) as avg_kills,
  avg(placement_points(g.team_rank)) as avg_placement_points
from member_ranking_games g
join members mem on mem.id = g.member_id
group by g.member_id, mem.tier;

-- 랭킹의 '최근 10경기'. 6각형이 쓰는 member_recent_stats 와 달리 두 출처를 합쳐 센다.
create or replace view member_recent_ranking_stats as
with ranked as (
  select
    member_id,
    kills,
    team_rank,
    row_number() over (partition by member_id order by played_at desc) as rn
  from member_ranking_games
)
select
  r.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(r.kills) as avg_kills,
  avg(placement_points(r.team_rank)) as avg_placement_points
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 10
group by r.member_id, mem.tier;

grant select on member_alltime_stats to anon;
grant select on member_alltime_stats to authenticated;
grant select on member_recent_ranking_stats to anon;
grant select on member_recent_ranking_stats to authenticated;

-- 6각형 전용으로 되돌린다. 0011 이 넣은 avg_placement_points 는 한 출처만 세므로
-- 랭킹이 쓰는 값과 조용히 어긋난다 — 두 개를 남겨두면 나중에 잘못 집는다.
-- create or replace 로는 뷰에서 컬럼을 못 뺀다. 지우고 다시 만든다.
drop view if exists member_recent_stats;
create view member_recent_stats as
with ranked as (
  select
    p.member_id,
    p.damage_dealt,
    p.kills,
    p.headshot_kills,
    p.time_survived,
    p.assists,
    p.team_rank,
    row_number() over (partition by p.member_id order by m.played_at desc) as rn
  from match_participants p
  join matches m using (pubg_match_id)
  where p.member_id is not null
)
select
  r.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(r.damage_dealt) as avg_damage,
  avg(r.kills) as avg_kills,
  case when sum(r.kills) = 0 then null
       else sum(r.headshot_kills)::numeric / sum(r.kills) end as headshot_ratio,
  avg(r.time_survived) as avg_survival,
  avg(r.assists) as avg_assists,
  avg(r.team_rank) as avg_rank
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 10
group by r.member_id, mem.tier;

grant select on member_recent_stats to anon;
grant select on member_recent_stats to authenticated;
