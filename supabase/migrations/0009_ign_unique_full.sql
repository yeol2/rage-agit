-- 0008 의 부분 유니크 인덱스를 전체 인덱스로 바꾼다.
--
-- 부분 인덱스(where pubg_account_id is null)는 중복을 막기는 하지만
-- ON CONFLICT 대상이 되지 못한다 — Postgres 가 부분 인덱스를 추론하려면
-- INSERT 문에 인덱스의 WHERE 절이 그대로 들어가야 하는데, PostgREST 의
-- upsert 는 그걸 표현할 방법이 없다. 적재가 통째로 막힌다.
--
-- 전체 인덱스로 바꿔도 잃는 게 없다. 한 경기 안에서 닉네임은 사람마다
-- 유일하고(PUBG 닉네임 자체가 시점마다 유일하다), 적용 시점의 기존
-- 데이터 648행에도 (매치, 닉네임) 중복이 0건이었다.

drop index if exists match_participants_ign_uniq;

create unique index if not exists match_participants_ign_uniq
  on match_participants (pubg_match_id, pubg_ign);
