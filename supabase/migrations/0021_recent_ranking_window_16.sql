-- 내전이 주 2회로 늘어나면서 "최근 12매치(내전 3회)" 창이 실제 운영 빈도보다
-- 좁아졌다. 16매치(내전 4회)로 넓힌다. 0013과 같은 구조, rn 상한만 바꾼다.

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
  avg(placement_points(r.team_rank)) as avg_placement_points,
  avg(r.team_rank) as avg_rank
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 16
group by r.member_id, mem.tier;
