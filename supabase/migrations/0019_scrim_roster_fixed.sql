-- 클릭 스왑을 고정(fix) 토글로 바꾸면서 필요해진 컬럼. 고정된 사람은 드래그로
-- 못 옮기게(클라이언트) + 나중에 만들 리롤이 건드리지 않게(서버) 하는 데 쓴다.
alter table scrim_roster_entries add column if not exists fixed boolean not null default false;

grant select (fixed) on scrim_roster_entries to anon;
grant select (fixed) on scrim_roster_entries to authenticated;
