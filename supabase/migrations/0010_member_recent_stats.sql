-- 클랜원 6각형 지표용 — 사람별 "최근 10경기" 집계를 미리 계산해둔다.
--
-- PostgREST 로는 "사람마다 최근 N개"라는 윈도우 연산을 표현할 수 없다.
-- window function 은 SQL 에서만 되므로 뷰로 만들어둔다. scrim_session_summary
-- 와 같은 패턴이다 — 비싼 연산은 Postgres 에 맡기고 화면은 결과만 읽는다.
--
-- 정확도는 경기별 비율의 평균이 아니라 헤드샷 합계/킬 합계로 낸다.
-- 어떤 경기에서 킬이 0이어도(그 경기의 비율이 0/0) 전체 합계 대 합계는
-- 문제없이 계산된다.

create or replace view member_recent_stats as
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
