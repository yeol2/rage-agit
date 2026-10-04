-- 저티어 내전을 일반 내전과 구분한다. 차이는 우승 트로피 하나뿐이다 —
-- 일반 내전 우승은 기존 내전우승 트로피, 저티어 내전 우승은 "꽃게들의 왕".
--
-- 저티어 여부는 내전마다 관리자가 01 티어 테이블의 토글로 정한다. 명단을 새로
-- 올리면 scrim_rosters 행이 새로 생기므로 기본값(false)으로 자연히 돌아간다.
alter table scrim_rosters add column if not exists low_tier boolean not null default false;

-- 화면은 anon 키로 명단을 읽는다(fetchLatestRoster) — 0016 방침대로 칼럼을
-- 명시적으로 열어야 토글이 새로고침 뒤에도 보인다.
grant select (low_tier) on scrim_rosters to anon;
grant select (low_tier) on scrim_rosters to authenticated;

-- 확정 시점의 저티어 여부를 등수 행에 박아둔다. 명단은 "초기화"로 지워지므로
-- 나중에 명단을 보고 되짚을 수 없다(0028 이 등수를 박아두는 것과 같은 이유).
-- 이미 있는 행은 전부 일반 내전이다.
alter table session_standings add column if not exists low_tier boolean not null default false;

-- 우승 횟수를 일반/저티어로 나눠 센다. 칼럼을 끝에 덧붙이는 것이라 create or
-- replace 로 바꿀 수 있다. 저티어 우승만 있는 사람도 행이 생기며 win_count 가
-- 0 이 된다 — 읽는 쪽은 원래 "행이 없으면 0" 으로 다루므로 그대로 맞는다.
create or replace view member_win_counts as
select
  member_id,
  (count(*) filter (where not low_tier))::integer as win_count,
  (count(*) filter (where low_tier))::integer as crab_king_count
from session_standings
where standing = 1
group by member_id;
