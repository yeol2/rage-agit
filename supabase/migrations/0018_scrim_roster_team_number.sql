-- "팀 구성" 버튼을 누르면 01 티어 테이블의 나열 순서 그대로 팀 번호를 매긴다.
-- 다시 누르면 assignTeamNumbers 가 전체를 재계산해 덮어쓰므로(멱등) 별도의
-- 유일 제약은 걸지 않는다.

alter table scrim_roster_entries add column if not exists team_number integer;

grant select (team_number) on scrim_roster_entries to anon;
grant select (team_number) on scrim_roster_entries to authenticated;
