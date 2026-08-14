-- 랭킹에서 오래 쉰 클랜원을 걸러내기 위해 마지막 참가일을 노출한다.
-- 통산 경기 수 자격(12경기)만으로는 "예전에 많이 뛰었지만 지금은 접은 사람"이
-- 계속 최상위권에 남는 문제가 있었다 — 최근 활동 여부를 앱 단(lib/rankingStats.ts)
-- 에서 같이 판정하기 위한 값이다.

create or replace view member_alltime_stats as
select
  g.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(g.kills) as avg_kills,
  avg(placement_points(g.team_rank)) as avg_placement_points,
  avg(g.team_rank) as avg_rank,
  max(g.played_at) as last_played_at
from member_ranking_games g
join members mem on mem.id = g.member_id
group by g.member_id, mem.tier;

grant select on member_alltime_stats to anon;
grant select on member_alltime_stats to authenticated;
