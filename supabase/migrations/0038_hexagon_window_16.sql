-- 6각형이 보는 창을 최근 10경기에서 **최근 16경기(내전 4회)** 로 넓힌다.
--
-- 같은 화면의 두 그림이 서로 다른 기간을 말하고 있었다. 리더보드와 클랜원
-- 대시보드의 "최근" 창은 16매치(내전 4회)인데 6각형만 10경기(내전 2.5회)였다.
-- 회차로 떨어지지도 않는 값이라, 화면에 "최근 10경기"라고 적어두면 그게 내전
-- 몇 번인지 읽는 사람이 나눠봐야 했다.
--
-- 16으로 맞추면 표본도 6할 늘어난다 — 안정성(등수 표준편차)처럼 흔들림을 재는
-- 축은 10경기로는 얇았다.
--
-- 집계 대상 판정은 0037 의 countable_matches 하나만 본다. rn 값 말고는 0036 과
-- 같다.

create or replace view member_recent_stats as
with ranked as (
  select
    p.member_id,
    p.damage_dealt,
    p.kills,
    p.time_survived,
    p.assists,
    p.team_rank,
    row_number() over (partition by p.member_id order by m.played_at desc) as rn
  from match_participants p
  join countable_matches m using (pubg_match_id)
  where p.member_id is not null
)
select
  r.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(r.damage_dealt) as avg_damage,
  avg(r.kills) as avg_kills,
  avg(r.time_survived) as avg_survival,
  avg(r.assists) as avg_assists,
  avg(r.team_rank) as avg_rank,
  stddev_samp(r.team_rank) as rank_stddev
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 16
group by r.member_id, mem.tier;

grant select on member_recent_stats to anon;
grant select on member_recent_stats to authenticated;
