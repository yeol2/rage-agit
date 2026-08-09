-- 내전 매치와 참가자 기록.
--
-- matches 에는 내전으로 판정된 매치만 들어간다.
-- polled_matches 는 우리가 살펴본 모든 matchId 를 판정 결과와 함께 기록한다 —
-- 이게 없으면 실행할 때마다 씨앗들의 경쟁전 수백 개를 다시 조회하게 된다
-- (어떤 매치인지는 열어보기 전에는 알 수 없기 때문이다).

create table if not exists matches (
  pubg_match_id text primary key,          -- PUBG 의 matchId 를 그대로 키로 쓴다
  played_at timestamptz not null,          -- 응답의 createdAt
  match_type text not null,
  game_mode text not null,
  map_name text,
  duration_seconds integer,
  participant_count integer not null,      -- 판별 근거를 남긴다
  clan_member_count integer not null,      -- 〃
  raw_attributes jsonb not null,
  polled_at timestamptz not null default now()
);

create table if not exists match_participants (
  id uuid primary key default gen_random_uuid(),
  pubg_match_id text not null references matches(pubg_match_id) on delete cascade,
  member_id uuid references members(id),   -- 비어 있을 수 있다 (미등록 참가자)
  pubg_account_id text not null,
  pubg_ign text not null,                  -- 그 경기 당시 닉네임
  team_id integer not null,
  team_rank integer not null,
  kills integer not null,
  assists integer not null,
  damage_dealt numeric not null,
  dbnos integer not null,
  headshot_kills integer not null,
  win_place integer not null,
  time_survived numeric not null,
  heals integer not null,
  boosts integer not null,
  longest_kill numeric not null,
  revives integer not null,
  raw_stats jsonb not null,
  unique (pubg_match_id, pubg_account_id)
);

create table if not exists polled_matches (
  pubg_match_id text primary key,
  is_scrim boolean not null,
  reason text not null,                    -- 왜 그렇게 판정했는지
  polled_at timestamptz not null default now()
);

create index if not exists match_participants_member_idx on match_participants (member_id);
create index if not exists matches_played_at_idx on matches (played_at desc);

alter table matches enable row level security;
alter table match_participants enable row level security;
alter table polled_matches enable row level security;

drop policy if exists "matches_select_public" on matches;
create policy "matches_select_public" on matches for select using (true);

drop policy if exists "match_participants_select_public" on match_participants;
create policy "match_participants_select_public" on match_participants for select using (true);

-- polled_matches 는 내부 운영 기록이라 공개 읽기 정책을 만들지 않는다.

-- 0004 에서 정한 방침대로 컬럼을 명시적으로 열어준다.
-- raw_attributes / raw_stats 에는 참가자 전원의 원본 스탯이,
-- pubg_account_id 에는 계정 식별자가 들어 있어 공개할 이유가 없다.
revoke select on matches from anon;
revoke select on matches from authenticated;
grant select (pubg_match_id, played_at, match_type, game_mode, map_name,
              duration_seconds, participant_count, clan_member_count, polled_at)
  on matches to anon;
grant select (pubg_match_id, played_at, match_type, game_mode, map_name,
              duration_seconds, participant_count, clan_member_count, polled_at)
  on matches to authenticated;

revoke select on match_participants from anon;
revoke select on match_participants from authenticated;
grant select (id, pubg_match_id, member_id, pubg_ign, team_id, team_rank,
              kills, assists, damage_dealt, dbnos, headshot_kills,
              win_place, time_survived, heals, boosts, longest_kill, revives)
  on match_participants to anon;
grant select (id, pubg_match_id, member_id, pubg_ign, team_id, team_rank,
              kills, assists, damage_dealt, dbnos, headshot_kills,
              win_place, time_survived, heals, boosts, longest_kill, revives)
  on match_participants to authenticated;

revoke select on polled_matches from anon;
revoke select on polled_matches from authenticated;
