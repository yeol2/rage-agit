-- 리매치(사고로 곧바로 다시 시작한 경기) 필터링. 2026-08-16 내전 4번째 경기가
-- 합 킬 0에 생존시간도 다른 경기의 절반 이하(13분)였고, 6분 뒤 진짜 4번째
-- 경기가 새로 시작됐다 — 그 매치가 그대로 집계에 섞여 있었다.
--
-- "합 킬(팀 전원 킬 합계)이 30을 안 넘으면 집계 대상 아님"을 매치 테이블
-- (실시간 API + dak.gg) 소스에만 앞으로도 계속 적용되는 규칙으로 건다.
-- 스크린샷 수기입력(scrim_screenshot_results)은 사람이 이미 검증해서 옮긴
-- 데이터라 대상에서 뺀다. matches/match_participants 로우 자체는 그대로
-- 두고, 랭킹 집계가 참조하는 이 뷰에서만 걸러낸다.

create or replace view member_ranking_games as
with valid_matches as (
  select mp.pubg_match_id
  from match_participants mp
  group by mp.pubg_match_id
  having sum(mp.kills) > 30
)
select p.member_id, p.kills, p.team_rank, m.played_at
from match_participants p
join matches m using (pubg_match_id)
join valid_matches vm using (pubg_match_id)
where p.member_id is not null
union all
select r.member_id, r.kills, r.team_rank,
  ((r.scrim_date::text || 'T20:') || lpad(r.round_no::text, 2, '0') || ':00+09:00')::timestamptz as played_at
from scrim_screenshot_results r
where r.member_id is not null;
