-- 맵별 기록의 기준선을 "내 다른 맵 평균"에서 **"내 전체 평균"** 으로 바꾼다.
--
-- 다른 맵 평균은 줄마다 다른 값이었다. 론도 줄의 기준은 (에란겔+미라마+태이고)
-- 평균이고 에란겔 줄의 기준은 (론도+미라마+태이고) 평균이라, 네 줄이 서로 다른
-- 네 개의 기준을 쓰면서 화면에서는 같은 세로선 하나로 그려졌다. 어느 맵이 강하고
-- 약한지 비교하려고 만든 그림인데, 비교의 기준이 줄마다 달랐던 셈이다.
--
-- 내 전체 평균 하나로 잡으면 네 줄이 같은 선을 공유하고, 편차의 합이 0이 된다 —
-- 위로 뻗은 만큼 아래로 뻗은 맵이 있다는 뜻이라 "강점과 약점"으로 바로 읽힌다.
--
-- 자격선(맵당 몇 경기)은 뷰에서 걸지 않는다. 화면이 모든 맵을 경기 수와 함께
-- 보여주고, 표본이 얇으면 얇다는 사실을 그 숫자가 스스로 말한다.

drop view if exists member_map_stats;

create view member_map_stats as
with games as (
  select p.member_id, m.map_name, p.team_rank, p.kills
  from match_participants p
  join countable_matches m using (pubg_match_id)
  where p.member_id is not null and m.map_name is not null
),
per_map as (
  select member_id, map_name, count(*) as games,
         sum(team_rank) as rank_sum, sum(kills) as kill_sum
  from games group by member_id, map_name
),
totals as (
  select member_id, count(*) as games, sum(team_rank) as rank_sum, sum(kills) as kill_sum
  from games group by member_id
)
select
  p.member_id,
  p.map_name,
  p.games::integer as games,
  round(p.rank_sum::numeric / p.games, 2) as avg_rank,
  round(p.kill_sum::numeric / p.games, 2) as avg_kills,
  t.games::integer as total_games,
  round(t.rank_sum::numeric / t.games, 2) as overall_avg_rank,
  round(t.kill_sum::numeric / t.games, 2) as overall_avg_kills
from per_map p
join totals t using (member_id);

grant select on member_map_stats to anon;
grant select on member_map_stats to authenticated;
