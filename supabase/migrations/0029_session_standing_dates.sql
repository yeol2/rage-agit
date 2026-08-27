-- "최근 N회 내전" 목록을 뽑기 위한 뷰.
--
-- 클랜원 대시보드 둘째 줄은 최근 N회 세션을 **누구에게나 같은 칸**으로 놓고,
-- 그 사람이 안 나온 회차만 등수 자리를 비운다. 그러려면 먼저 "어떤 세션들인가"를
-- 정해야 하는데, scrim_sessions 를 그냥 최신순으로 자르면 아직 등수를 확정하지
-- 않은 내전이 빈 칸만 열여섯 개 달고 끼어든다.
--
-- 그래서 session_standings 에 실제로 기록이 있는 날짜만 센다. standing_count 가
-- 1 이면 0027 에서 옮겨온 우승팀만 있는 옛 세션이라(2026-06 이전), 화면은 그런
-- 세션을 걸러 써야 한다 — 우승팀 넷을 뺀 전원이 "안 나옴"으로 보이면 거짓말이다.
create or replace view session_standing_dates as
select
  scrim_date,
  session_number,
  count(distinct standing)::integer as standing_count,
  count(*)::integer as member_count
from session_standings
group by scrim_date, session_number;

grant select on session_standing_dates to anon;
grant select on session_standing_dates to authenticated;
