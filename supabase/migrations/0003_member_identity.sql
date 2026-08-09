-- 사람을 식별하는 기준을 '서버 별명'에서 '디스코드 사용자명'으로 옮긴다.
-- 별명은 사람들이 수시로 바꾸고 유일성도 보장되지 않는 반면,
-- 디스코드 사용자명은 전역 유일하고 거의 바뀌지 않는다.
--
-- 0001/0002 와 달리 이 파일부터는 scripts/apply-migration.mjs 로 적용한다.

alter table members add column if not exists discord_username text;

-- Postgres 유일 인덱스는 NULL 중복을 허용하므로,
-- 기존 행의 discord_username 이 비어 있는 상태에서도 바로 걸 수 있다.
create unique index if not exists members_clan_discord_username_key
  on members (clan_id, discord_username);

-- 별명에 걸려 있던 유일성 제약을 뗀다.
-- 제약 이름은 Postgres 가 자동 생성한 것이라, apply-migration.mjs 가
-- 적용 후 실제로 사라졌는지 pg_constraint 를 조회해 확인한다.
alter table members drop constraint if exists members_clan_id_discord_nickname_key;

-- 티어 값이 0~5 의 0.5 단위라는 것이 실제 클랜 데이터로 확인되었다.
-- Table Editor 에서 손으로 고칠 때 오타를 막는다.
alter table members drop constraint if exists members_tier_valid;
alter table members add constraint members_tier_valid
  check (tier in (0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5));
