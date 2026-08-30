-- 깐부 / 사대가 안 맞는 사람 — "누구와 같은 팀이었을 때 성적이 좋았나".
--
-- 같은 팀이었다는 사실은 두 출처에 다른 모양으로 남아 있다.
--   match_participants  : 같은 pubg_match_id + 같은 team_id
--   scrim_screenshot_results : 같은 scrim_date + round_no + 같은 team_no
-- 아래 games CTE 가 둘을 team_key 하나로 통일한다. 합치지 않으면 2026-02~05
-- (스크린샷만 남은 시기)가 통째로 빠져서 표본이 절반이 된다.
--
-- 집계 대상 판정은 member_ranking_games(0026)와 같은 규칙을 쓴다 — 제외 표시된
-- 매치와 합 킬 30 이하 재경기를 뺀다. 같은 경기를 랭킹에서는 빼고 여기서는
-- 세면 "평균등수"가 화면마다 달라진다.
--
-- 비교 기준은 **그 사람과 같은 팀이 아니었던 경기의 평균등수**다. 통산 평균과
-- 비교하면 함께한 경기가 통산에도 들어 있어 차이가 자기 자신 쪽으로 끌려간다.
-- 표본이 얇은 게 이 지표의 유일한 약점이라(조합의 대부분이 내전 한 번뿐),
-- 자격선은 DB 가 아니라 화면(lib/partnerStats.ts)에서 건다 — 뷰는 있는 그대로의
-- 숫자를 내고, 몇 경기부터 보여줄지는 나중에 바꿀 수 있어야 한다.

create or replace view member_partner_stats as
with games as (
  select
    p.pubg_match_id || '#' || p.team_id::text as team_key,
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
    r.member_id,
    r.team_rank
  from scrim_screenshot_results r
  where r.member_id is not null
),
totals as (
  select member_id, count(*) as games, sum(team_rank) as rank_sum
  from games group by member_id
),
pairs as (
  select
    a.member_id,
    b.member_id as partner_id,
    count(*) as games,
    sum(a.team_rank) as rank_sum
  from games a
  join games b on b.team_key = a.team_key and b.member_id <> a.member_id
  group by a.member_id, b.member_id
)
select
  p.member_id,
  p.partner_id,
  p.games::integer as games_together,
  round(p.rank_sum::numeric / p.games, 2) as avg_rank_together,
  (t.games - p.games)::integer as games_apart,
  -- 함께한 경기가 그 사람의 전부라면 비교할 것이 없다 → null.
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

-- 뷰가 소유자 권한으로 도는 덕에 anon 이 밑의 표들을 직접 읽을 필요가 없다
-- (0012 의 다른 뷰들과 같다). 나가는 값은 member_id 두 개와 등수 통계뿐이라
-- 0004 의 식별자 비공개 방침에 걸리는 칸이 없다.
grant select on member_partner_stats to anon;
grant select on member_partner_stats to authenticated;
