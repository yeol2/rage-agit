-- 저티어 내전은 **리더보드 점수에만** 빠진다. 사용자 정리(2026-10-05): "오로지 점수만 반영이
-- 안 되도록 하고 나머지는 전부 반영". 0047 은 저티어를 지표 뷰 다섯 개 전부에서 뺐는데,
-- 그건 너무 넓었다 — 6각형·깐부·맵 통계·플레이 스타일 뱃지는 저티어 내전도 센다.
--
-- 그래서 "확정됐다"(저티어 포함)와 "점수에 센다"(확정 + 저티어 아님)를 나눈다.
--   confirmed_matches — 우승 확정된 내전의 매치. 6각형·깐부·맵·플레이 스타일이 본다.
--   ranked_matches    — 그중 저티어가 아닌 것(0047 그대로). member_ranking_games 만 본다
--                       → 리더보드 종합점수·평균등수·평균킬, 등수 변동.
-- 확정 전 내전은 여전히 어디에도 안 들어간다.
create or replace view confirmed_matches as
select m.*
from countable_matches m
join scrim_sessions s on s.id = m.scrim_session_id
where exists (
  select 1 from session_standings st
  where st.scrim_date = s.scrim_date
    and st.session_number = coalesce(s.session_number, 1)
);

grant select on confirmed_matches to anon;
grant select on confirmed_matches to authenticated;

-- member_partner_stats
create or replace view member_partner_stats as
WITH games AS (
         SELECT (p_1.pubg_match_id || '#'::text) || p_1.team_id::text AS team_key,
            (m.played_at AT TIME ZONE 'Asia/Seoul'::text)::date AS scrim_date,
            p_1.member_id,
            p_1.team_rank
           FROM match_participants p_1
             JOIN confirmed_matches m USING (pubg_match_id)
          WHERE p_1.member_id IS NOT NULL
        UNION ALL
         SELECT (((r.scrim_date::text || '-'::text) || r.round_no::text) || '#'::text) || r.team_no::text,
            r.scrim_date,
            r.member_id,
            r.team_rank
           FROM scrim_screenshot_results r
          WHERE r.member_id IS NOT NULL
        ), totals AS (
         SELECT games.member_id,
            count(*) AS games,
            sum(games.team_rank) AS rank_sum,
            array_agg(DISTINCT games.scrim_date) AS scrim_dates
           FROM games
          GROUP BY games.member_id
        ), pairs AS (
         SELECT a.member_id,
            b.member_id AS partner_id,
            count(*) AS games,
            sum(a.team_rank) AS rank_sum,
            array_agg(DISTINCT a.scrim_date) AS scrim_dates
           FROM games a
             JOIN games b ON b.team_key = a.team_key AND b.member_id <> a.member_id
          GROUP BY a.member_id, b.member_id
        )
 SELECT p.member_id,
    p.partner_id,
    p.games::integer AS games_together,
    cardinality(p.scrim_dates) AS sessions_together,
    round(p.rank_sum::numeric / p.games::numeric, 2) AS avg_rank_together,
    (t.games - p.games)::integer AS games_apart,
    cardinality(ARRAY( SELECT unnest(t.scrim_dates) AS unnest
        EXCEPT
         SELECT unnest(p.scrim_dates) AS unnest)) AS sessions_apart,
        CASE
            WHEN t.games > p.games THEN round((t.rank_sum - p.rank_sum)::numeric / (t.games - p.games)::numeric, 2)
            ELSE NULL::numeric
        END AS avg_rank_apart,
        CASE
            WHEN t.games > p.games THEN round((t.rank_sum - p.rank_sum)::numeric / (t.games - p.games)::numeric - p.rank_sum::numeric / p.games::numeric, 2)
            ELSE NULL::numeric
        END AS rank_delta
   FROM pairs p
     JOIN totals t USING (member_id);

-- member_hexagon_stats
create or replace view member_hexagon_stats as
SELECT p.member_id,
    mem.tier,
    count(*)::integer AS game_count,
    avg(p.damage_dealt) AS avg_damage,
    avg(p.kills) AS avg_kills,
    avg(p.time_survived) AS avg_survival,
    avg(p.assists) AS avg_assists,
    avg(p.team_rank) AS avg_rank,
    stddev_samp(p.team_rank) AS rank_stddev
   FROM match_participants p
     JOIN confirmed_matches m USING (pubg_match_id)
     JOIN members mem ON mem.id = p.member_id
  WHERE p.member_id IS NOT NULL
  GROUP BY p.member_id, mem.tier;

-- member_map_stats
create or replace view member_map_stats as
WITH screenshot AS (
         SELECT r.member_id,
            COALESCE(o.map_name, d.map_name) AS map_name,
            r.team_rank,
            r.kills
           FROM scrim_screenshot_results r
             LEFT JOIN ( VALUES (1,'Neon_Main'::text), (2,'Baltic_Main'::text), (3,'Desert_Main'::text), (4,'Tiger_Main'::text)) d(round_no, map_name) ON d.round_no = r.round_no
             LEFT JOIN scrim_round_maps o ON o.scrim_date = r.scrim_date AND o.round_no = r.round_no
          WHERE r.member_id IS NOT NULL
        ), games AS (
         SELECT p_1.member_id,
            m.map_name,
            p_1.team_rank,
            p_1.kills
           FROM match_participants p_1
             JOIN confirmed_matches m USING (pubg_match_id)
          WHERE p_1.member_id IS NOT NULL AND m.map_name IS NOT NULL
        UNION ALL
         SELECT screenshot.member_id,
            screenshot.map_name,
            screenshot.team_rank,
            screenshot.kills
           FROM screenshot
          WHERE screenshot.map_name IS NOT NULL
        ), per_map AS (
         SELECT games.member_id,
            games.map_name,
            count(*) AS games,
            sum(games.team_rank) AS rank_sum,
            sum(games.kills) AS kill_sum
           FROM games
          GROUP BY games.member_id, games.map_name
        ), totals AS (
         SELECT games.member_id,
            count(*) AS games,
            sum(games.team_rank) AS rank_sum,
            sum(games.kills) AS kill_sum
           FROM games
          GROUP BY games.member_id
        )
 SELECT p.member_id,
    p.map_name,
    p.games::integer AS games,
    round(p.rank_sum::numeric / p.games::numeric, 2) AS avg_rank,
    round(p.kill_sum::numeric / p.games::numeric, 2) AS avg_kills,
    t.games::integer AS total_games,
    round(t.rank_sum::numeric / t.games::numeric, 2) AS overall_avg_rank,
    round(t.kill_sum::numeric / t.games::numeric, 2) AS overall_avg_kills
   FROM per_map p
     JOIN totals t USING (member_id);

-- member_playstyle_stats
create or replace view member_playstyle_stats as
SELECT p.member_id,
    mem.tier,
    count(*)::integer AS game_count,
    sum(p.kills)::integer AS total_kills,
    sum(p.dbnos)::integer AS total_dbnos,
    sum(p.damage_dealt) AS total_damage
   FROM match_participants p
     JOIN confirmed_matches m USING (pubg_match_id)
     JOIN members mem ON mem.id = p.member_id
  WHERE p.member_id IS NOT NULL
  GROUP BY p.member_id, mem.tier;
