-- "집계에 세는 매치"의 정의를 한 곳으로 모은다.
--
-- 지금까지 이 판정이 세 군데에 흩어져 있었고, 곳마다 규칙이 달랐다.
--
--   적재 시점 (supabase/functions/_shared/matches.mjs) : 합 킬 30 이하면 안 넣는다
--   지표 뷰 (member_ranking_games 등)                  : 제외 표시 + 합 킬 30
--   내전 시트·세션 요약·매치 목록                       : 제외 표시만
--
-- 세 번째 줄이 문제다. 재경기가 이미 표에 들어와 있는 상태(적재 검사가 없던
-- 시절에 들어왔거나, dak.gg 백필처럼 적재 검사가 아예 안 도는 출처)에서 사람이
-- 제외 표시를 달기 전까지, 시트는 그 매치를 라운드로 세고 지표는 안 센다.
-- 같은 내전을 화면마다 다르게 말하는 상태다.
--
-- 그래서 판정을 뷰 하나로 만들고 모두가 그것만 읽는다. 규칙이 바뀔 일이 생기면
-- 고칠 곳이 (적재 시점 상수와) 여기 둘뿐이다.
--
-- 두 조건을 다 유지하는 이유:
--   합 킬 30  — 사람이 아무것도 안 해도 걸린다. 2026-08-30 재경기가 적재 시점에
--               이 조건으로 걸러졌다(합 킬 0). 대부분의 재경기가 여기서 끝난다.
--   제외 표시 — 위 조건이 못 보는 것을 사람이 잡는다. 30킬을 넘긴 뒤 중단된
--               재경기, 그리고 재경기가 아니지만 세면 안 되는 매치(0026 의
--               컬럼 주석 참고). 지금은 2026-08-16 한 건뿐이고, 그 매치는
--               합 킬도 0이라 두 조건 모두에 걸린다.

create or replace view countable_matches as
select
  m.pubg_match_id,
  m.scrim_session_id,
  m.played_at,
  m.match_type,
  m.game_mode,
  m.map_name,
  m.duration_seconds,
  m.participant_count,
  m.clan_member_count,
  m.source,
  m.polled_at
from matches m
where m.excluded_reason is null
  and (
    -- 합 킬은 참가자 행에서 센다. 참가자가 하나도 없는 매치(적재가 중간에
    -- 끊긴 경우)는 셀 것이 없으므로 여기서 자연히 빠진다.
    select coalesce(sum(p.kills), 0)
    from match_participants p
    where p.pubg_match_id = m.pubg_match_id
  ) > 30;

grant select on countable_matches to anon;
grant select on countable_matches to authenticated;

-- 이제 이 뷰들은 자기 조건을 들고 있지 않는다. 판정은 countable_matches 가 한다.

create or replace view member_ranking_games as
select p.member_id, p.kills, p.team_rank, m.played_at
from match_participants p
join countable_matches m using (pubg_match_id)
where p.member_id is not null
union all
select r.member_id, r.kills, r.team_rank,
  ((r.scrim_date::text || 'T20:') || lpad(r.round_no::text, 2, '0') || ':00+09:00')::timestamptz as played_at
from scrim_screenshot_results r
where r.member_id is not null;

create or replace view member_partner_stats as
with games as (
  select
    p.pubg_match_id || '#' || p.team_id::text as team_key,
    (m.played_at at time zone 'Asia/Seoul')::date as scrim_date,
    p.member_id,
    p.team_rank
  from match_participants p
  join countable_matches m using (pubg_match_id)
  where p.member_id is not null
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
  select member_id, count(*) as games, sum(team_rank) as rank_sum,
         array_agg(distinct scrim_date) as scrim_dates
  from games group by member_id
),
pairs as (
  select a.member_id, b.member_id as partner_id,
         count(*) as games, sum(a.team_rank) as rank_sum,
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
  cardinality(array(
    select unnest(t.scrim_dates) except select unnest(p.scrim_dates)
  ))::integer as sessions_apart,
  case when t.games > p.games
    then round((t.rank_sum - p.rank_sum)::numeric / (t.games - p.games), 2)
  end as avg_rank_apart,
  case when t.games > p.games
    then round(
      (t.rank_sum - p.rank_sum)::numeric / (t.games - p.games)
      - p.rank_sum::numeric / p.games, 2)
  end as rank_delta
from pairs p
join totals t using (member_id);

create or replace view member_recent_stats as
with ranked as (
  select
    p.member_id, p.damage_dealt, p.kills, p.time_survived, p.assists, p.team_rank,
    row_number() over (partition by p.member_id order by m.played_at desc) as rn
  from match_participants p
  join countable_matches m using (pubg_match_id)
  where p.member_id is not null
)
select
  r.member_id,
  mem.tier,
  count(*)::integer as game_count,
  avg(r.damage_dealt) as avg_damage,
  avg(r.kills) as avg_kills,
  avg(r.time_survived) as avg_survival,
  avg(r.assists) as avg_assists,
  avg(r.team_rank) as avg_rank,
  stddev_samp(r.team_rank) as rank_stddev
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 10
group by r.member_id, mem.tier;

-- 내전 요약(매치 기록 화면의 "몇 경기 / 몇 명")도 같은 판정을 쓴다. 여기가
-- 제외 표시만 보던 자리다.
create or replace view scrim_session_summary as
select
  s.id,
  s.clan_id,
  s.scrim_date,
  s.title,
  s.session_number,
  s.replay_url,
  count(distinct m.pubg_match_id) as match_count,
  count(distinct coalesce(p.member_id::text, p.pubg_account_id, p.pubg_ign)) as participant_count,
  min(m.played_at) as started_at
from scrim_sessions s
left join countable_matches m on m.scrim_session_id = s.id
left join match_participants p on p.pubg_match_id = m.pubg_match_id
group by s.id;
