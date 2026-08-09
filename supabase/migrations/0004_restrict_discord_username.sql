-- discord_username 을 공개 읽기 대상에서 뺀다.
--
-- 0003 에서 이 컬럼을 추가했더니 members 의 공개 select 정책을 타고
-- anon 키로 클랜원 전원의 디스코드 사용자명이 읽히게 됐다.
-- anon 키는 프론트엔드에 박혀 공개되는 값이므로 사실상 누구나 조회할 수 있다.
--
-- 별명(discord_nickname)은 원래부터 공개였고 대시보드가 써야 하므로 남긴다.
-- 사용자명은 그 사람을 실제로 찾아 연락할 수 있는 값이라 성격이 다르다.
--
-- RLS 는 행 단위라 컬럼을 가릴 수 없다. 컬럼 단위 GRANT 로 처리한다.
-- 테이블 전체 select 를 회수한 뒤 필요한 컬럼만 다시 부여하는 순서여야 한다
-- (테이블 권한이 남아 있으면 컬럼 권한만 빼는 것으로는 가려지지 않는다).
--
-- 부수 효과: 앞으로 members 에 컬럼을 추가하면 anon 은 기본적으로 그 컬럼을
-- 못 읽는다. 공개해야 하는 컬럼이면 그때 명시적으로 grant 한다 — 실수로
-- 열리는 것보다 실수로 닫히는 편이 낫다.

revoke select on members from anon;
revoke select on members from authenticated;

grant select (id, clan_id, discord_nickname, tier, is_active, created_at, updated_at)
  on members to anon;
grant select (id, clan_id, discord_nickname, tier, is_active, created_at, updated_at)
  on members to authenticated;
