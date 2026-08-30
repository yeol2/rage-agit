-- 깐부 자격선을 경기 단위에서 **내전 단위**로 바꾼다.
--
-- 0034 는 "8경기 이상 함께"였다. 내전 한 번이 보통 4경기라 사실상 "내전 두 번"을
-- 뜻했지만, 그날 라운드가 3판이거나 5판이면 같은 두 번이 어떤 조합은 통과하고
-- 어떤 조합은 떨어진다. 사람이 세는 단위는 경기가 아니라 내전 회차이므로
-- 세는 쪽을 그 단위에 맞춘다.
--
-- 내전 회차는 한국시간 날짜로 센다 — scrim_screenshot_results.scrim_date 와
-- session_standings.scrim_date 가 이미 그 기준이라(0007/0012), 매치 쪽 played_at
-- 만 같은 기준으로 옮기면 두 출처가 같은 날짜로 만난다.
--
-- 평균등수는 그대로 경기 단위다. 등수는 경기마다 나오는 값이라 회차로 묶어
-- 평균 내면 라운드가 적은 날의 한 판이 더 무거워진다.

-- 칸이 늘고 순서도 바뀌므로 replace 로는 안 된다(뷰 컬럼은 이름·순서를 못 바꾼다).
drop view if exists member_partner_stats;
create view member_partner_stats as
with games as (
  select
    p.pubg_match_id || '#' || p.team_id::text as team_key,
    (m.played_at at time zone 'Asia/Seoul')::date as scrim_date,
    p.member_id,
    p.team_rank
  from match_participants p
  join matches m using (pubg_match_id)
  join (
    select pubg_match_id from match_participants group by 1 having sum(kills) > 30
  ) v using (pubg_match_id)
  where p.member_id is not null
    and m.excluded_reason is null
  union all
  select
    r.scrim_date::text || '-' || r.round_no::text || '#' || r.team_no::text,
    r.scrim_date,
    r.member_id,
    r.team_rank
  from scrim_screenshot_results r
  where r.member_id is not null
),
totals as (
  select
    member_id,
    count(*) as games,
    sum(team_rank) as rank_sum,
    array_agg(distinct scrim_date) as scrim_dates
  from games group by member_id
),
pairs as (
  select
    a.member_id,
    b.member_id as partner_id,
    count(*) as games,
    sum(a.team_rank) as rank_sum,
    array_agg(distinct a.scrim_date) as scrim_dates
  from games a
  join games b on b.team_key = a.team_key and b.member_id <> a.member_id
  group by a.member_id, b.member_id
)
select
  p.member_id,
  p.partner_id,
  p.games::integer as games_together,
  cardinality(p.scrim_dates)::integer as sessions_together,
  round(p.rank_sum::numeric / p.games, 2) as avg_rank_together,
  (t.games - p.games)::integer as games_apart,
  -- 날짜 집합에서 빼는 이유: 한 내전 안에서도 라운드마다 팀이 바뀌면 그날은
  -- 함께한 날이면서 따로 한 날이기도 하다. 회차 수를 그냥 빼면 그런 날이
  -- 어느 쪽에서도 안 세어지거나 두 번 세어진다.
  cardinality(array(
    select unnest(t.scrim_dates) except select unnest(p.scrim_dates)
  ))::integer as sessions_apart,
  case when t.games > p.games
    then round((t.rank_sum - p.rank_sum)::numeric / (t.games - p.games), 2)
  end as avg_rank_apart,
  -- 양수면 그 사람과 함께일 때 더 높은 등수(= 숫자가 작다)를 했다는 뜻이다.
  case when t.games > p.games
    then round(
      (t.rank_sum - p.rank_sum)::numeric / (t.games - p.games)
      - p.rank_sum::numeric / p.games, 2)
  end as rank_delta
from pairs p
join totals t using (member_id);

grant select on member_partner_stats to anon;
grant select on member_partner_stats to authenticated;
