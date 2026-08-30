-- 6각형 지표에서 헤드샷을 빼고 **안정성**을 넣는다. 그리고 여기도 재경기를
-- 걸러낸다.
--
-- 두 가지가 한 번에 고쳐진다.
--
-- 1) 재경기가 그대로 들어와 있었다. 0023/0026 은 랭킹이 보는 뷰
--    (member_ranking_games)에만 필터를 걸었고 이 뷰는 빠졌다. 그래서 2026-08-16
--    재경기(합 킬 0, 13분)가 최근 10경기 창에 36행 들어 있었고, 그 사람들은
--    딜량과 생존이 실제보다 낮게 잡혔다. 판정 규칙은 0026 과 글자 그대로 같게
--    맞춘다 — 같은 경기를 한쪽에서는 세고 한쪽에서는 빼면 화면마다 다른 사람이 된다.
--
-- 2) 헤드샷 비율은 실력이 아니라 분모를 재고 있었다. 최근 10경기 총 킬이 5킬
--    이하인 사람이 집계 대상 142명 중 62명이고, 0~1킬도 13명이다. 1킬 중
--    1헤드샷이면 100% 로 찍힌다. 실제로 등수와의 상관이 -0.26 이었다 — 헤드샷
--    비율이 높을수록 등수가 나쁘다는 뜻이니, 실력 축이었다면 나올 수 없는 값이다.
--
--    대신 넣는 안정성(rank_stddev)은 그 사람의 경기별 팀등수가 얼마나 흔들리는지다.
--    작을수록 안정적이다. 이 값에는 분모 문제가 없다 — 경기마다 등수는 반드시
--    하나씩 나온다. 기존 다섯 축 어느 것과도 겹치지 않는다(킬 -0.10, 딜량 0.01,
--    생존 -0.17, 어시 0.09).
--
--    실력 축이 아니라 성향 축이다. 늘 8등인 사람이 이 축에서 가장 높다.
--
-- 컬럼이 바뀌므로 replace 로는 안 되고 drop 후 다시 만든다. 이 뷰에 기대는
-- 다른 뷰는 없다(확인함).

drop view if exists member_recent_stats;

create view member_recent_stats as
with valid_matches as (
  -- 0026 과 같은 규칙: 제외 표시된 매치와 합 킬 30 이하 재경기를 뺀다.
  select mp.pubg_match_id
  from match_participants mp
  join matches m using (pubg_match_id)
  where m.excluded_reason is null
  group by mp.pubg_match_id
  having sum(mp.kills) > 30
),
ranked as (
  select
    p.member_id,
    p.damage_dealt,
    p.kills,
    p.time_survived,
    p.assists,
    p.team_rank,
    row_number() over (partition by p.member_id order by m.played_at desc) as rn
  from match_participants p
  join matches m using (pubg_match_id)
  join valid_matches vm using (pubg_match_id)
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
  -- 안정성. 표본표준편차라 경기가 하나뿐이면 null 이다(6각형은 4경기부터
  -- 그리므로 화면에서는 볼 일이 없지만, 뷰 자체는 그 경우를 만든다).
  stddev_samp(r.team_rank) as rank_stddev
from ranked r
join members mem on mem.id = r.member_id
where r.rn <= 10
group by r.member_id, mem.tier;

grant select on member_recent_stats to anon;
grant select on member_recent_stats to authenticated;
