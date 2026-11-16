-- 놀이터 · 반응속도 테스트 랭킹. 클랜원 한 명당 한 줄 — 자기 최고 기록(5회 평균)만 남긴다.
--
-- 로그인이 없어서 "누가 했는지"는 PUBG 닉네임 + 클랜 코드(서버 환경변수 REACTION_CLAN_CODE)로
-- 거른다. 그래서 이 표는 anon 키로 읽기·쓰기를 열지 않는다 — 읽기도 쓰기도 서버 라우트
-- (service role)만 한다. 탈퇴자는 members 행이 지워지므로 cascade 로 같이 빠진다.
create table if not exists reaction_records (
  member_id uuid primary key references members(id) on delete cascade,
  best_avg_ms integer not null check (best_avg_ms between 100 and 2000),
  best_single_ms integer not null check (best_single_ms between 100 and 2000),
  attempts integer not null default 1,
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reaction_records_rank_idx
  on reaction_records (best_avg_ms, achieved_at);

alter table reaction_records enable row level security;
