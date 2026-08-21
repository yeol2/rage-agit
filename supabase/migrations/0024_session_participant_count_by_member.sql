-- scrim_session_summary.participant_count 가 "사람 수"가 아니라 "PUBG 계정 수"를
-- 세고 있었다 — 같은 클랜원이 세션 중 본계정+부계정을 나눠 뛰면(예:
-- 2026-08-20, Ez_Jukatory) 그 한 명이 2로 잡혀서 실제 참여 인원(4의 배수여야
-- 하는 정사각형 스쿼드 수)과 어긋났다.
--
-- member_id 를 최우선으로 묶고(등록된 클랜원은 본계정/부계정이 몇 개든
-- 한 명으로), member_id 가 없는(미등록 게스트) 참가자만 기존처럼
-- pubg_account_id/pubg_ign 으로 구분한다.

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
left join matches m on m.scrim_session_id = s.id
left join match_participants p on p.pubg_match_id = m.pubg_match_id
group by s.id;
