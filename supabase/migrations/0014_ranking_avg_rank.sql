-- 랭킹 포디움에 '평균등수' 탭을 추가하기 위해 원시 팀등수(1~16등) 평균을 노출한다.
-- avg_placement_points(배치점수 평균)와는 다른 값이다 — 등수 그대로의 평균이라
-- 낮을수록 좋다.

create or replace view member_alltime_stats as
select
  g.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(g.kills) as avg_kills,
  avg(placement_points(g.team_rank)) as avg_placement_points,
  avg(g.team_rank) as avg_rank
from member_ranking_games g
join members mem on mem.id = g.member_id
group by g.member_id, mem.tier;

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
where r.rn <= 12
group by r.member_id, mem.tier;

grant select on member_alltime_stats to anon;
grant select on member_alltime_stats to authenticated;
grant select on member_recent_ranking_stats to anon;
grant select on member_recent_ranking_stats to authenticated;
