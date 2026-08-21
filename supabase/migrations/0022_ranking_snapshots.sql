-- 내전(4매치) 세션이 끝날 때마다 종합점수 등수 스냅샷을 남겨, 리더보드에서
-- 직전 세션 대비 등수 변화(상승/하락/신규)를 보여준다.
--
-- group_id 는 lib/dashboardData.ts 의 TIER_GROUPS.id 를 그대로 쓴다('all' +
-- 티어 그룹들) — 리더보드 탭 구조와 정확히 대응시켜 어느 탭에서 보든 그
-- 탭 기준 등수 변화가 나오게 한다. unique 제약이라 캡처마다 upsert로 이전
-- 값을 덮어써서 항상 "가장 최근 세션 이전" 스냅샷 하나만 남는다.

-- 컬럼 이름은 "window"가 아니라 "ranking_window"다 — WINDOW 는 Postgres
-- 예약어라 그대로 쓰면 DDL 파싱 에러가 난다.
create table if not exists ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  ranking_window text not null check (ranking_window in ('recent16', 'alltime')),
  group_id text not null,
  member_id uuid not null references members(id) on delete cascade,
  rank_position integer not null,
  captured_at timestamptz not null default now(),
  unique (ranking_window, group_id, member_id)
);

alter table ranking_snapshots enable row level security;
create policy "ranking_snapshots_select_public" on ranking_snapshots for select using (true);

-- 쓰기(INSERT/UPDATE)는 0016 패턴과 같은 방식으로 service role 로만 한다 —
-- 이 정책들과 무관하게, INSERT/UPDATE 정책을 안 만들었으므로 anon/authenticated
-- 키로는 애초에 쓸 수 없다.
grant select on ranking_snapshots to anon;
grant select on ranking_snapshots to authenticated;

-- 이 로스터(내전 세션)에서 스냅샷을 이미 캡처했는지 표시하는 1회성 플래그.
-- 서버(service role)만 읽고 쓰므로 anon/authenticated 에는 따로 안 가린다
-- (0004 의 컬럼 단위 grant 는 클라이언트가 읽어야 하는 컬럼에만 필요하다).
alter table scrim_rosters add column if not exists ranking_snapshot_captured_at timestamptz;
