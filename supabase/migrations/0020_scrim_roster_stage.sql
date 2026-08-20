-- 01/02/03 화면 진행 상태를 저장한다. 팀 구성·라운드 점수 자체는(team_number,
-- match_participants) 이미 다른 곳에 저장돼 있으니, 이건 순전히 "새로고침해도
-- 몇 단계까지 왔는지 잊지 않기" 위한 값이다. 01→02→03 외의 조합은 불가능하므로
-- boolean 두 개가 아니라 컬럼 하나로 둔다.
alter table scrim_rosters add column if not exists stage text not null default '01'
  check (stage in ('01', '02', '03'));

grant select (stage) on scrim_rosters to anon;
grant select (stage) on scrim_rosters to authenticated;
