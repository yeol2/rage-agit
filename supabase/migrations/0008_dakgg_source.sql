-- dak.gg 화면에서 읽은 과거 내전을 받기 위한 스키마 변경.
--
-- dak.gg 에는 PUBG matchId 도, 경기 시각도, 계정 ID 도 없고
-- 회복/부스터/소생 칸도 없다. 없는 값을 0 으로 채우면 SQL 이 그걸
-- 진짜 관측값으로 취급해서 평균을 조용히 끌어내린다. NULL 은 집계가
-- 건너뛴다 — 그래서 not null 을 푼다.

alter table matches
  add column if not exists source text not null default 'pubg_api';

-- dak.gg 표에 없는 칸들. 기존 API 행은 값이 그대로 있으니 아무것도 안 바뀐다.
alter table match_participants alter column heals drop not null;
alter table match_participants alter column boosts drop not null;
alter table match_participants alter column revives drop not null;

-- 닉네임을 못 알아본 참가자(탈퇴한 옛 클랜원, 게스트, 개명자)용 예외 경로다.
-- 등록된 클랜원은 member_pubg_accounts 에서 계정 ID 를 찾아 채운다.
alter table match_participants alter column pubg_account_id drop not null;

-- dak.gg 는 이동거리를 합계로만 준다(도보/탑승 분리 불가).
-- API 출처도 walk+ride 를 여기에 채워서 화면이 이 컬럼 하나만 보게 한다.
alter table match_participants
  add column if not exists total_distance numeric;

-- 0005 의 unique (pubg_match_id, pubg_account_id) 는 계정 ID 가 NULL 이면
-- 걸리지 않는다 — Postgres 에서 NULL 은 서로 같지 않기 때문이다.
-- 그 행들만 닉네임으로 막는다.
create unique index if not exists match_participants_ign_uniq
  on match_participants (pubg_match_id, pubg_ign)
  where pubg_account_id is null;

-- 0007 의 뷰가 참가자를 count(distinct pubg_account_id) 로 셌는데,
-- count(distinct) 는 NULL 행을 통째로 뺀다. 지금까지는 API 가 항상
-- playerId 를 줘서 안 드러났지만, NULL 이 섞이면 '64명 내전'이 조용히 줄어든다.
create or replace view scrim_session_summary as
select s.id,
       s.clan_id,
       s.scrim_date,
       s.title,
       s.session_number,
       s.replay_url,
       count(distinct m.pubg_match_id) as match_count,
       count(distinct coalesce(p.pubg_account_id, p.pubg_ign)) as participant_count,
       min(m.played_at) as started_at
from scrim_sessions s
left join matches m on m.scrim_session_id = s.id
left join match_participants p on p.pubg_match_id = m.pubg_match_id
group by s.id;

-- 0004 방침대로 새 컬럼도 명시적으로 연다. 안 열면 프론트에서 안 읽힌다.
grant select (source) on matches to anon;
grant select (source) on matches to authenticated;
grant select (total_distance) on match_participants to anon;
grant select (total_distance) on match_participants to authenticated;
