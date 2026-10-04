-- 화면 곳곳(매치 기록의 내전 목록, 클랜원 화면의 종합등수 칩 등)에 "저티어 내전"
-- 표시를 달려면 내전 단위로 저티어 여부를 읽어야 한다. 저티어 여부는 우승 확정 때
-- session_standings.low_tier 에 박힌다(0045). 그 표는 anon 이 직접 못 읽으므로
-- 이미 공개된 날짜별 뷰(0029)에 칼럼을 끝에 덧붙인다.
create or replace view session_standing_dates as
select
  scrim_date,
  session_number,
  count(distinct standing)::integer as standing_count,
  count(*)::integer as member_count,
  bool_or(low_tier) as low_tier
from session_standings
group by scrim_date, session_number;
