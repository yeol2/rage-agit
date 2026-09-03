-- 6각형을 **역대 전체**로 바꾸고, 뷰 이름을 하는 일에 맞춘다.
--
-- 창을 두는 이유가 없어졌다. 리더보드는 "요즘 잘하는 사람"을 가려야 하므로 최근
-- 창이 필요하지만, 클랜원 상세의 6각형은 그 사람이 어떤 선수인가를 보여주는
-- 자리다. 거기서 창을 자르면 지난달에 잘한 기록이 그림에서 사라지고, 표본도
-- 얇아져 안정성처럼 흔들림을 재는 축이 특히 흔들린다.
--
-- 이름도 바꾼다. member_recent_stats 는 0010 에서 "최근 10경기"를 담으려고 만든
-- 이름인데 이제 최근이 아니다. 하는 일과 다른 이름을 남겨두면 다음에 이 뷰를
-- 여는 사람이 창이 있는 줄 알고 찾는다.
--
-- 최소 표본은 화면(lib/memberStats.ts)이 건다 — 통산 내전 4회(16경기)로,
-- 리더보드 자격과 같은 선이다. 다만 리더보드의 "최근 3개월" 규칙은 걸지 않는다:
-- 리더보드는 등수를 다투는 자리라 접은 사람이 남아 있으면 안 되지만, 자기
-- 페이지의 6각형은 접었다고 지워야 할 기록이 아니다.

create or replace view member_hexagon_stats as
select
  p.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(p.damage_dealt) as avg_damage,
  avg(p.kills) as avg_kills,
  avg(p.time_survived) as avg_survival,
  avg(p.assists) as avg_assists,
  avg(p.team_rank) as avg_rank,
  stddev_samp(p.team_rank) as rank_stddev
from match_participants p
join countable_matches m using (pubg_match_id)
join members mem on mem.id = p.member_id
where p.member_id is not null
group by p.member_id, mem.tier;

grant select on member_hexagon_stats to anon;
grant select on member_hexagon_stats to authenticated;

-- 옛 이름은 지운다. 남겨두면 둘 중 어느 것이 진짜인지 다음 사람이 헷갈린다
-- (의존하는 뷰가 없는 것을 확인했다).
drop view if exists member_recent_stats;
