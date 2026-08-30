-- session_wins 를 지운다. 0028 의 session_standings 가 상위호환이라 할 일이 없다.
--
-- 0027 은 "우승 횟수를 세는 게 이 표의 유일한 용도"라고 적어뒀는데, 0028 이
-- 1~16위 전부를 담게 되면서 우승은 그중 standing = 1 일 뿐이 됐다. 그때
-- member_win_counts 뷰도 session_standings 를 보도록 옮겼으므로, 지금 이 표는
-- 아무도 읽지 않는다 — 화면·뷰·API 어디에도 참조가 없다.
--
-- 남겨두면 해로운 이유: 앞으로 확정되는 내전은 session_standings 에만 쌓인다.
-- 두 표가 갈라진 채로 남아 있으면 나중에 우승 횟수를 세려다 옛 표를 집어들기
-- 쉽다(그러면 최근 내전의 트로피가 통째로 빠진다).

-- 지우기 전에 정말 다 옮겨졌는지 확인한다. 0028 의 이관을 눈으로 봤더라도
-- 이 파일은 다른 환경에서도 돌 수 있으므로 여기서 다시 따진다.
-- 하나라도 안 옮겨졌으면 트로피가 조용히 사라지므로 통째로 중단시킨다.
do $$
declare
  orphans integer;
begin
  if to_regclass('public.session_wins') is null then
    return; -- 이미 지워진 환경
  end if;

  select count(*) into orphans
  from session_wins w
  where not exists (
    select 1 from session_standings s
    where s.scrim_date = w.scrim_date
      and s.session_number = w.session_number
      and s.member_id = w.member_id
      and s.standing = 1
  );

  if orphans > 0 then
    raise exception
      'session_wins 의 우승 기록 %건이 session_standings 에 없다 — 이관을 먼저 끝낼 것', orphans;
  end if;
end $$;

drop table if exists session_wins;
