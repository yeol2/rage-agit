-- 0023 은 "합 킬 30 이하" 휴리스틱으로 재경기를 랭킹 집계에서만 걸러냈다.
-- 그것만으로는 두 가지가 부족하다.
--
-- 1. 왜 뺐는지가 어디에도 안 남는다. 나중에 보면 그 매치가 왜 통계에서
--    사라졌는지 데이터만 봐서는 알 수 없다.
-- 2. 랭킹 뷰 말고 다른 곳은 여전히 그 매치를 본다. 실제로 내전 시트
--    (app/api/scrim-roster/round-sheet)는 세션의 매치를 played_at 순으로
--    앞 4개만 가져가는데, 2026-08-16 은 재경기가 4번째로 들어가는 바람에
--    진짜 4라운드(12:46)가 통째로 잘려나가고 있었다.
--
-- 그래서 제외 사유를 매치 행에 직접 남기고, 집계하는 쪽이 이 컬럼 하나만
-- 보면 되게 한다. 휴리스틱은 그대로 둔다 — 사람이 표시하는 걸 잊어도
-- 자동으로 걸리는 그물이 하나 더 있는 편이 안전하고, dak.gg 백필처럼
-- 참가자 스탯 없이 들어온 출처는 적재 시점 검사가 아예 안 돌기 때문이다.

alter table matches add column if not exists excluded_reason text;

comment on column matches.excluded_reason is
  '집계에서 뺄 매치의 사유. null 이면 정상 매치다. 재경기처럼 실제로 치러지긴 했으나 결과를 세면 안 되는 매치에 쓴다.';

grant select (excluded_reason) on matches to anon;
grant select (excluded_reason) on matches to authenticated;

-- 2026-08-16 4번째 경기. 63명이 13분(779초)을 보내고 합 킬 0, 합 데미지 123
-- 이었고, 6분 뒤 같은 맵(Tiger)에서 진짜 4라운드를 다시 치렀다.
update matches
set excluded_reason = '재경기 — 합 킬 0으로 중단, 6분 뒤 같은 맵에서 다시 치름'
where pubg_match_id = 'caa76fed-7219-4bd3-8077-075e02221197'
  and excluded_reason is null;

-- "매치 기록" 화면이 읽는 세션 요약도 재경기를 빼고 센다. 안 그러면
-- 2026-08-16 이 "5경기"로, 참여 인원도 재경기에 낀 사람만큼 부풀어 보인다.
-- 0024 의 정의에서 조인 조건 하나만 더한 것이다.
create or replace view scrim_session_summary as
select
  s.id,
  s.clan_id,
  s.scrim_date,
  s.title,
  s.session_number,
  s.replay_url,
  count(distinct m.pubg_match_id) as match_count,
  count(distinct coalesce(p.member_id::text, p.pubg_account_id, p.pubg_ign)) as participant_count,
  min(m.played_at) as started_at
from scrim_sessions s
left join matches m on m.scrim_session_id = s.id and m.excluded_reason is null
left join match_participants p on p.pubg_match_id = m.pubg_match_id
group by s.id;

-- 랭킹 집계에 제외 플래그를 더한다. 합 킬 휴리스틱은 유지한다(위 주석 참고).
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
  and m.excluded_reason is null
union all
select r.member_id, r.kills, r.team_rank,
  ((r.scrim_date::text || 'T20:') || lpad(r.round_no::text, 2, '0') || ':00+09:00')::timestamptz as played_at
from scrim_screenshot_results r
where r.member_id is not null;
