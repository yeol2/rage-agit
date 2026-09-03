-- 맵별 기록 — "이 사람은 어느 맵에서 잘하고 어느 맵에서 못하나".
--
-- 내전은 네 라운드가 늘 같은 맵 순서로 돈다(론도 → 에란겔 → 미라마 → 태이고).
-- 그래서 참가한 내전 회차 = 각 맵을 뛴 경기 수다 — 실측으로도 예외가 없다
-- (lib/scrimCounting.ts 주석 참고). 자격선을 맵마다 따로 정할 필요가 없고,
-- 리더보드와 같은 "통산 내전 4회"가 그대로 "맵당 4경기"가 된다.
--
-- 비교 기준은 **그 사람의 다른 맵**이다. 클랜 전체와 비교하면 상위 티어가 네
-- 맵의 상위를 전부 가져가서 "이 맵에서만 유독"이라는 말이 사라진다. 다른 맵
-- 대비로 보면 8등짜리가 에란겔에서만 5등을 하는 것이 그대로 드러난다.
--
-- 집계 대상 판정은 0037 의 countable_matches 하나만 본다.

create or replace view member_map_stats as
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
  (t.games - p.games)::integer as other_games,
  -- 다른 맵이 아예 없을 수는 없지만(내전은 네 맵을 다 돈다) 한 맵만 남은 옛
  -- 기록이 있을 수 있어 0 나누기를 막는다.
  case when t.games > p.games
    then round((t.rank_sum - p.rank_sum)::numeric / (t.games - p.games), 2)
  end as other_avg_rank,
  -- 양수면 그 맵에서 더 높은 등수(= 숫자가 작다)를 했다는 뜻이다.
  case when t.games > p.games
    then round(
      (t.rank_sum - p.rank_sum)::numeric / (t.games - p.games)
      - p.rank_sum::numeric / p.games, 2)
  end as rank_delta
from per_map p
join totals t using (member_id);

grant select on member_map_stats to anon;
grant select on member_map_stats to authenticated;
