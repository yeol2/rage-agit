-- 플레이 스타일 뱃지를 **티어 그룹별로 한 명씩** 주기로 해서, 집계에 티어를 싣는다.
--
-- 클랜 전체에서 한 명만 뽑으면 뱃지가 세 개뿐이라 대부분의 사람과 무관한
-- 장식이 된다. 리더보드와 같은 티어 그룹(0~1.5 / 2~2.5 / 3~3.5 / 4~5) 안에서
-- 한 명씩 뽑으면 12명이 달고, "내 그룹 안에서 내가 1등"이 바로 읽힌다.
--
-- 개별 티어(0, 1, 1.5, …)로 자르지 않는 이유는 표본이다. 자격(내전 4회 +
-- 통산 킬 20 + 기절 20)을 채운 사람이 5티어는 0명, 1티어와 4.5티어는 4명뿐이라
-- 뱃지 3개를 후보 4명이 나눠 갖는 꼴이 된다. 그룹으로 묶으면 19/29/34/10명이다.

-- 열이 중간에 끼어들어 create or replace 로는 못 바꾼다(열 이름 변경으로 본다).
drop view if exists member_playstyle_stats;

create view member_playstyle_stats as
select
  p.member_id,
  mem.tier,
  count(*)::integer as game_count,
  sum(p.kills)::integer as total_kills,
  sum(p.dbnos)::integer as total_dbnos,
  sum(p.damage_dealt) as total_damage
from match_participants p
join countable_matches m using (pubg_match_id)
join members mem on mem.id = p.member_id
where p.member_id is not null
group by p.member_id, mem.tier;

grant select on member_playstyle_stats to anon;
grant select on member_playstyle_stats to authenticated;
