-- 리더보드·6각형·지표는 **우승 확정을 누른 내전만** 센다. 저티어 내전은 확정해도
-- 세지 않는다(트로피 뱃지만 주고 끝난다).
--
-- 지금까지는 폴링이 매치를 적재하는 순간 countable_matches 에 들어가 바로 집계됐다.
-- 그래서 내전 도중(1~3경기만 들어온 상태)에도 랭킹 숫자가 움직였다.
--
-- countable_matches 자체를 좁히지 않는 이유: 03 내전 시트·세션 요약·매치 목록도
-- 그 뷰를 읽는다. 시트는 확정 **전에** 라운드를 보여줘야 확정을 누를 수 있다.
-- 그래서 집계용 뷰를 하나 더 두고, 지표 뷰들만 그쪽을 보게 한다.
--
-- "확정됨" = 그 날짜·회차의 종합등수(session_standings)가 저장돼 있다. 적용 시점에
-- 확인해보니 매치가 있는 과거 내전은 전부 확정돼 있었다(2026-10-04 진행 중인 것만
-- 미확정) — 이 뷰로 바꿔도 과거 기록이 빠지지 않는다.
-- scrim_sessions.session_number 는 비어 있고 확정 쪽은 1 로 저장하므로 맞춰 비교한다.
create or replace view ranked_matches as
select m.*
from countable_matches m
join scrim_sessions s on s.id = m.scrim_session_id
where exists (
    select 1 from session_standings st
    where st.scrim_date = s.scrim_date
      and st.session_number = coalesce(s.session_number, 1)
  )
  and not exists (
    select 1 from session_standings st
    where st.scrim_date = s.scrim_date
      and st.session_number = coalesce(s.session_number, 1)
      and st.low_tier
  );

grant select on ranked_matches to anon;
grant select on ranked_matches to authenticated;

-- 아래는 지표 뷰들을 라이브 정의 그대로 두고, 읽는 매치만 ranked_matches 로 바꾼 것.

-- member_ranking_games
create or replace view member_ranking_games as
SELECT p.member_id,
    p.kills,
    p.team_rank,
    m.played_at
   FROM match_participants p
     JOIN ranked_matches m USING (pubg_match_id)
  WHERE p.member_id IS NOT NULL
UNION ALL
 SELECT r.member_id,
    r.kills,
    r.team_rank,
    (((r.scrim_date::text || 'T20:'::text) || lpad(r.round_no::text, 2, '0'::text)) || ':00+09:00'::text)::timestamp with time zone AS played_at
   FROM scrim_screenshot_results r
  WHERE r.member_id IS NOT NULL;

-- member_partner_stats
create or replace view member_partner_stats as
WITH games AS (
         SELECT (p_1.pubg_match_id || '#'::text) || p_1.team_id::text AS team_key,
            (m.played_at AT TIME ZONE 'Asia/Seoul'::text)::date AS scrim_date,
            p_1.member_id,
            p_1.team_rank
           FROM match_participants p_1
             JOIN ranked_matches m USING (pubg_match_id)
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
     JOIN ranked_matches m USING (pubg_match_id)
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
             JOIN ranked_matches m USING (pubg_match_id)
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
     JOIN ranked_matches m USING (pubg_match_id)
     JOIN members mem ON mem.id = p.member_id
  WHERE p.member_id IS NOT NULL
  GROUP BY p.member_id, mem.tier;
