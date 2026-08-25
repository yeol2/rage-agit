-- 내전 종합우승 기록.
--
-- 우승은 매치 단위가 아니라 세션(하루 내전) 단위다. 그날 치른 라운드(보통 4)의
-- 팀 점수를 모두 더해 1위인 팀이 종합우승이고, 그 팀원 전원이 우승 1회를 갖는다.
-- 총점이 같으면 순위점수(PLACE)가 높은 쪽이 위다 — 2026-02-01 시트에서 39점
-- 동점인 두 팀의 순서가 킬이 아니라 순위점수로 갈린 것으로 확인했다.
--
-- 왜 집계해서 그때그때 구하지 않고 표로 저장하나:
-- 우승팀을 데이터에서 되짚을 수가 없다. 탈퇴자 정리(apply-departed-members.mjs)가
-- 탈퇴한 사람의 참가 기록을 행째로 지우기 때문에 팀 킬 합계가 미달된다.
-- team_rank 는 팀 단위 값이라 멀쩡하지만 총점 = 순위점수 + 킬이라 순위가 뒤집힌다.
-- 실제로 2026-05-31 은 남은 데이터로 계산하면 우승팀이 #11 이 아니라 #08 로
-- 나온다(시트에는 #11 이 39점 1위, 빠진 Pitt 의 8킬이 통째로 사라진 탓이다).
-- 그래서 결과 스크린샷의 종합 시트에서 우승 팀번호를 읽어 여기에 박아둔다.
--
-- 팀원 한 명이 한 행이다. 세션당 한 행에 배열로 담지 않는 이유는 클랜원별
-- 우승 횟수를 세는 게 이 표의 유일한 용도라서다 — member_id 로 바로 세면 된다.
--
-- 탈퇴자는 애초에 들어오지 않는다(members 에 없으니 member_id 를 못 만든다).
-- 우승 횟수는 클랜원 화면에만 쓰이므로 그게 맞다.

create table if not exists session_wins (
  id uuid primary key default gen_random_uuid(),
  scrim_date date not null,              -- 한국시간 기준 날짜 (0007/0012 와 같은 기준)
  session_number integer not null default 1, -- 하루에 내전이 두 번 열릴 수 있다 (scrim_sessions 와 같은 규칙)
  -- 종합 시트에 적힌 우승 팀번호. 매치 시대(2026-06-07~)는 PUBG 의 team_id 가
  -- 매치마다 새로 매겨져 세션 단위 팀번호라는 게 없으므로 비워 둔다.
  team_no integer,
  member_id uuid not null references members(id) on delete cascade,
  source text not null,                  -- 'screenshot' | 'match' — 우승팀을 무엇으로 확정했나
  note text,                             -- 판독 근거(이미지 파일명 등)
  created_at timestamptz not null default now(),
  -- 한 사람이 같은 세션에서 두 번 우승할 수는 없다.
  unique (scrim_date, session_number, member_id)
);

create index if not exists session_wins_member_idx on session_wins (member_id);

alter table session_wins enable row level security;

-- 클랜원별 우승 횟수. 0012 의 다른 뷰들처럼 뷰가 소유자 권한으로 돌아서
-- anon 이 session_wins 를 직접 읽을 필요가 없다.
create or replace view member_win_counts as
select member_id, count(*)::integer as win_count
from session_wins
group by member_id;

grant select on member_win_counts to anon;
grant select on member_win_counts to authenticated;
