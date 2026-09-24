-- 플레이 스타일 뱃지("딜딸러/킬딸러/실속") 가 볼 사람별 합계.
--
-- 평균이 아니라 **합계**를 담는다. 뱃지가 보는 값은 킬당 딜량(총딜/총킬)과
-- 기절당 킬(총킬/총기절)인데, 경기별 비율의 평균으로 내면 킬이 0인 경기가
-- 0/0 이 되어 버린다. 0010 에서 헤드샷 비율을 합계 대 합계로 낸 것과 같은 이유다.
--
-- 대상 경기는 countable_matches — 6각형·리더보드와 같은 기준이다. 탈퇴자는
-- member_id 연결이 끊긴 행으로 남으므로(members 조인) 자연히 빠진다.
--
-- 다만 스크린샷으로 받아적은 내전(scrim_screenshot_results)은 못 센다. 거기엔
-- 등수와 킬만 있고 딜량·기절이 없어서다. 그래서 같은 사람도 전적 요약의
-- 경기 수(스크린샷 포함)보다 여기 game_count 가 적다 — 뱃지가 보는 것은
-- "딜량을 잴 수 있는 경기"뿐이다.
--
-- 비율 자체는 여기서 안 나눈다. 총킬 0, 총기절 0 인 사람을 어떻게 다룰지는
-- 뱃지 규칙이라 lib/playstyleBadges.ts 한 곳에서만 정한다.

create or replace view member_playstyle_stats as
select
  p.member_id,
  count(*)::integer as game_count,
  sum(p.kills)::integer as total_kills,
  sum(p.dbnos)::integer as total_dbnos,
  sum(p.damage_dealt) as total_damage
from match_participants p
join countable_matches m using (pubg_match_id)
join members mem on mem.id = p.member_id
where p.member_id is not null
group by p.member_id;

grant select on member_playstyle_stats to anon;
grant select on member_playstyle_stats to authenticated;
