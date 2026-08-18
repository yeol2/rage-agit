-- 내전 팀 구성 테이블 1단계: 대기 음성채널 명단 업로드 + 티어 자동배치.
--
-- memberlist 봇이 뽑은 CSV/TXT 를 관리자가 업로드하면 members.discord_username 으로
-- 매칭해 여기 저장한다. 업로드할 때마다 새 scrim_rosters 행을 추가한다(히스토리 보존,
-- 화면은 fetched_at 최신 행만 보여준다).

create table if not exists scrim_rosters (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id),
  fetched_at timestamptz not null default now()
);

create table if not exists scrim_roster_entries (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references scrim_rosters(id) on delete cascade,
  discord_username text not null,        -- 업로드 파일의 User 컬럼(매칭 키)
  discord_nickname text,                 -- 업로드 파일의 Nickname 컬럼(표시용)
  member_id uuid references members(id), -- 매칭 성공 시만 채움
  tier numeric(3,1),                     -- 매칭 시점의 티어 스냅샷
  tier_slot int,                         -- 1~4, 매칭 성공 시 기본 매핑값
  matched boolean not null default false
);

alter table scrim_rosters enable row level security;
alter table scrim_roster_entries enable row level security;

create policy "scrim_rosters_select_public" on scrim_rosters for select using (true);
create policy "scrim_roster_entries_select_public" on scrim_roster_entries for select using (true);

-- discord_username 은 members.discord_username 과 같은 성격(실제로 그 사람을 찾을 수
-- 있는 값)이라 0004 방침대로 anon/authenticated 에서 컬럼 단위로 가린다.
-- 쓰기(INSERT)는 이 정책들과 무관하게 service role 로만 한다 — RLS 는 INSERT 정책을
-- 안 만들었으므로 anon/authenticated 키로는 애초에 쓸 수 없다.
revoke select on scrim_roster_entries from anon;
revoke select on scrim_roster_entries from authenticated;
grant select (id, roster_id, discord_nickname, member_id, tier, tier_slot, matched)
  on scrim_roster_entries to anon;
grant select (id, roster_id, discord_nickname, member_id, tier, tier_slot, matched)
  on scrim_roster_entries to authenticated;
