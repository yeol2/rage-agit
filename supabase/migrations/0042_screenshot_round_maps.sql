-- 스크린샷 시대(2026-02-07 ~ 05-30)의 맵을 라운드 번호에서 되살린다.
--
-- 그 시절 기록은 디스코드 결과 사진을 사람이 옮긴 것이라 맵 이름이 없다. 사진에
-- 찍힌 것은 최종 순위표뿐이고, 거기에는 어느 맵이었는지가 안 나온다. 그래서
-- 맵별 기록이 매치 기록 시대(4,180행)만 세고 절반을 버리고 있었다.
--
-- 하지만 버릴 필요가 없다. 내전은 네 라운드가 맵 순서까지 고정이고,
-- scrim_screenshot_results 에 round_no 가 이미 남아 있다. 매치 기록이 있는 17회
-- 내전을 전부 확인했는데 순서가 어긋난 날이 한 번도 없었다:
--
--   2026-06-06 ~ 08-29, 17/17회  론도 > 에란겔 > 미라마 > 태이고
--
-- 스크린샷 시대 17회도 라운드 1~4가 빠짐없이 들어 있다. 그러면 3,896행을 사람이
-- 다시 치는 게 아니라 규칙 한 줄로 채우는 것이 맞다.
--
-- 다만 이것은 **관찰이 아니라 가정**이다. 매치 기록이 없는 기간이라 순서가 그때도
-- 같았다는 것은 데이터로 확인할 수 없고, 관리자의 기억에 기댄다. 가정이 틀린
-- 날이 나중에 밝혀질 수 있으므로, 예외를 적을 자리를 같이 만들어 둔다 —
-- scrim_round_maps 에 그 날짜와 라운드를 한 줄 넣으면 기본 순환을 덮어쓴다.
-- 마이그레이션을 고칠 필요가 없다.

create table if not exists scrim_round_maps (
  scrim_date date not null,
  round_no integer not null,
  map_name text not null,
  note text,
  primary key (scrim_date, round_no)
);

comment on table scrim_round_maps is
  '기본 맵 순환(1론도 2에란겔 3미라마 4태이고)과 달랐던 날만 적는다. '
  '비어 있으면 모든 날이 기본 순환을 따른다는 뜻이다. '
  '매치 기록이 있는 날에는 영향이 없다 — 그쪽은 실제 맵 이름을 쓴다.';

alter table scrim_round_maps enable row level security;
-- 정책을 두지 않는다. 읽기는 뷰가 대신하고, 쓰기는 서비스 롤(관리자)만 한다.

drop view if exists member_map_stats;

create view member_map_stats as
with screenshot as (
  select
    r.member_id,
    coalesce(o.map_name, d.map_name) as map_name,
    r.team_rank,
    r.kills
  from scrim_screenshot_results r
  -- 기본 순환. 라운드 번호가 곧 맵이다.
  left join (values (1, 'Neon_Main'), (2, 'Baltic_Main'), (3, 'Desert_Main'), (4, 'Tiger_Main'))
    as d(round_no, map_name) on d.round_no = r.round_no
  -- 그날만 달랐다면 이쪽이 이긴다.
  left join scrim_round_maps o
    on o.scrim_date = r.scrim_date and o.round_no = r.round_no
  where r.member_id is not null
),
games as (
  select p.member_id, m.map_name, p.team_rank, p.kills
  from match_participants p
  join countable_matches m using (pubg_match_id)
  where p.member_id is not null and m.map_name is not null
  union all
  -- 5라운드 이상이 찍힌 날이 나오면(순환에도 없고 예외에도 없는 라운드)
  -- 맵을 모르는 것이므로 세지 않는다. 모르는 것을 1라운드로 밀어넣지 않는다.
  select member_id, map_name, team_rank, kills from screenshot where map_name is not null
),
per_map as (
  select member_id, map_name, count(*) as games,
         sum(team_rank) as rank_sum, sum(kills) as kill_sum
  from games group by member_id, map_name
),
totals as (
  select member_id, count(*) as games, sum(team_rank) as rank_sum, sum(kills) as kill_sum
  from games group by member_id
)
select
  p.member_id,
  p.map_name,
  p.games::integer as games,
  round(p.rank_sum::numeric / p.games, 2) as avg_rank,
  round(p.kill_sum::numeric / p.games, 2) as avg_kills,
  t.games::integer as total_games,
  round(t.rank_sum::numeric / t.games, 2) as overall_avg_rank,
  round(t.kill_sum::numeric / t.games, 2) as overall_avg_kills
from per_map p
join totals t using (member_id);

grant select on member_map_stats to anon;
grant select on member_map_stats to authenticated;
