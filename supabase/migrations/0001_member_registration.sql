-- 클랜원 등록 스키마 (1단계): clans, members, member_pubg_accounts
-- 한 사람(디스코드 정체성)이 여러 PUBG IGN을 가질 수 있도록 1:N으로 분리했다.

create table clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id),
  discord_nickname text not null,
  tier numeric(3,1) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, discord_nickname)
);

create table member_pubg_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  pubg_ign text not null,
  pubg_account_id text,
  created_at timestamptz not null default now(),
  unique (pubg_ign)
);

alter table clans enable row level security;
alter table members enable row level security;
alter table member_pubg_accounts enable row level security;

create policy "clans_select_public" on clans for select using (true);
create policy "members_select_public" on members for select using (true);
create policy "member_pubg_accounts_select_public" on member_pubg_accounts for select using (true);
