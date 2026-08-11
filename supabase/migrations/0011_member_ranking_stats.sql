-- 등수+킬 랭킹 포디움용 — 매치 팀등수를 점수로 바꾼 평균(avg_placement_points)과,
-- 창(최근10/역대) 구분 없는 통산 경기 수를 추가한다. 통산 경기 수는 최근10경기
-- 랭킹을 볼 때도 최소 참가 자격 판정 기준으로 쓴다 — 0010의 member_recent_stats.game_count
-- 는 최대 10으로 잘려서 이 판정에는 못 쓴다.
--
-- 점수표: 1등 10 / 2등 6 / 3등 5 / 4등 4 / 5등 3 / 6등 2 / 7~8등 1 / 9등 이하 0.

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
  avg(r.team_rank) as avg_rank,
  avg(case
        when r.team_rank = 1 then 10
        when r.team_rank = 2 then 6
        when r.team_rank = 3 then 5
        when r.team_rank = 4 then 4
        when r.team_rank = 5 then 3
        when r.team_rank = 6 then 2
        when r.team_rank in (7, 8) then 1
        else 0
      end) as avg_placement_points
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 10
group by r.member_id, mem.tier;

grant select on member_recent_stats to anon;
grant select on member_recent_stats to authenticated;

-- 창 구분 없는 통산 집계. member_recent_stats 와 컬럼 구성을 맞추되 rn 제한이 없다.
create or replace view member_alltime_stats as
select
  p.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(p.damage_dealt) as avg_damage,
  avg(p.kills) as avg_kills,
  case when sum(p.kills) = 0 then null
       else sum(p.headshot_kills)::numeric / sum(p.kills) end as headshot_ratio,
  avg(p.time_survived) as avg_survival,
  avg(p.assists) as avg_assists,
  avg(p.team_rank) as avg_rank,
  avg(case
        when p.team_rank = 1 then 10
        when p.team_rank = 2 then 6
        when p.team_rank = 3 then 5
        when p.team_rank = 4 then 4
        when p.team_rank = 5 then 3
        when p.team_rank = 6 then 2
        when p.team_rank in (7, 8) then 1
        else 0
      end) as avg_placement_points
from match_participants p
join matches m using (pubg_match_id)
join members mem on mem.id = p.member_id
where p.member_id is not null
group by p.member_id, mem.tier;

grant select on member_alltime_stats to anon;
grant select on member_alltime_stats to authenticated;
