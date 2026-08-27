-- 팀 구성/리롤/VIP 정렬은 최대 64개 행의 team_number 를 한 번에 바꾼다.
--
-- 지금까지는 Promise.all 로 행마다 따로 UPDATE 를 날렸다 — 64개의 개별 네트워크
-- 요청이 동시에 나가는 구조라, 그중 하나만 타임아웃/네트워크 오류가 나도 나머지
-- 63개는 이미 커밋된 채로 남는다(Promise.all 은 트랜잭션이 아니다). 그 상태로
-- API 가 500을 돌려주면 화면은 실패로 보이지만 DB 는 반쪽만 바뀌어 있고, 다음에
-- 누가 새로고침하면 03 팀 구성 표에 그 한 자리만 빈 칸으로 남는다.
--
-- 여러 번의 왕복을 한 번의 SQL 문으로 묶어 전부 성공하거나 전부 실패하게 한다.
create or replace function apply_team_number_updates(updates jsonb, reset_fixed boolean default false)
returns void
language sql
as $$
  update scrim_roster_entries e
  set team_number = (u.value->>'teamNumber')::int,
      fixed = case when reset_fixed then false else e.fixed end
  from jsonb_array_elements(updates) as u(value)
  where e.id = (u.value->>'id')::uuid;
$$;

-- 서버 라우트가 service_role 키로만 부른다 — anon/authenticated 에게는 안 연다.
-- 함수를 만들면 Postgres 가 기본으로 PUBLIC 에 실행 권한을 준다 — anon/authenticated
-- 는 PUBLIC 을 통해 상속받으므로, 그 둘에서만 따로 걷어내면 PUBLIC 권한이 그대로
-- 살아 있어 노출된 anon 키로도 이 함수를 직접 부를 수 있다(team_number 를
-- 검증 없이 아무 값이나 써넣게 된다). PUBLIC 자체에서 걷어내야 실제로 막힌다.
revoke execute on function apply_team_number_updates(jsonb, boolean) from public;
revoke execute on function apply_team_number_updates(jsonb, boolean) from anon;
revoke execute on function apply_team_number_updates(jsonb, boolean) from authenticated;
