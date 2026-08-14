-- 랭킹 포디움의 '최근' 창을 10경기 -> 12경기(내전 3회)로 맞춘다.
-- MIN_GAMES_FOR_RANKING(랭킹 최소 자격)도 12경기라, 최근 창과 자격 기준이
-- 같은 단위(내전 3회)로 맞아떨어지게 하려는 것이다.
--
-- 6각형이 쓰는 member_recent_stats(0010/0012)는 건드리지 않는다 — 그쪽은
-- 여전히 최근 10경기 기준이다. 랭킹 전용 member_recent_ranking_stats만 바꾼다.

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
where r.rn <= 12
group by r.member_id, mem.tier;
