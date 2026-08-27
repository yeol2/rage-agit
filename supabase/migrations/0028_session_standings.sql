-- 내전 세션 최종등수(종합등수) 1~16 전부를 저장한다.
--
-- 0027 은 우승팀(1위)만 남겼다. 그걸로 트로피는 셀 수 있었지만, 클랜원 화면의
-- "최근 N회 내전 종합등수" 줄처럼 2~16위가 필요한 곳은 답이 없었다.
-- 계산해서 그때그때 구할 수도 없다 — 이유는 0027 주석에 그대로 있다(탈퇴자
-- 정리가 참가 기록을 행째로 지워서 팀 킬 합계가 미달되고, 총점 = 순위점수 + 킬
-- 이라 순위가 뒤집힌다). 그래서 확정 시점의 값을 그대로 박아둔다.
--
-- 0027 과 같이 "사람 한 명이 한 행"이다. 등수는 팀 단위지만 조회는 늘 사람
-- 기준(이 사람이 그날 몇 등이었나)이라 그 모양이 그대로 답이 된다.
-- 팀원 4명이 같은 standing 을 나눠 갖는다.
--
-- session_wins 는 지우지 않는다. 거기 있는 값은 결과 스크린샷의 종합 시트를
-- 사람이 눈으로 읽은 것이고, 계산과 어긋나는 세션이 실제로 있다
-- (data/session-winners.json 의 2026-06-21 참고). 앞으로 쓰지는 않되 검산
-- 근거로 남겨둔다 — 아래에서 그 내용을 standing=1 로 옮긴다.

create table if not exists session_standings (
  id uuid primary key default gen_random_uuid(),
  scrim_date date not null,                  -- 한국시간 기준 날짜 (0007/0012/0027 과 같은 기준)
  session_number integer not null default 1, -- 하루에 내전이 두 번 열릴 수 있다
  standing integer not null,                 -- 그날 종합등수 (1 이 우승)
  -- 시트/로스터에 적힌 팀번호. 0027 때는 매치 시대에 채울 방법이 없어 비워뒀지만,
  -- 02 팀 구성 테이블(scrim_roster_entries.team_number)이 생긴 뒤로는 세션 단위
  -- 팀번호가 실제로 있다.
  team_no integer,
  -- 확정 시점의 누적값. 나중에 판독/계산이 맞았는지 되짚는 유일한 근거라
  -- 등수만 남기지 않고 같이 박아둔다 (시트의 PLACE / KILL / TOTAL 칸).
  place_points integer,
  kills integer,
  total_score integer,
  member_id uuid not null references members(id) on delete cascade,
  source text not null,                      -- 'sheet' | 'match' — 무엇으로 확정했나
  note text,
  created_at timestamptz not null default now(),
  -- 한 사람이 같은 세션에서 두 개의 등수를 가질 수는 없다. 이 제약이 없으면
  -- 확정 버튼을 두 번 눌렀을 때 등수가 조용히 두 배로 쌓인다.
  unique (scrim_date, session_number, member_id)
);

create index if not exists session_standings_member_idx on session_standings (member_id);
create index if not exists session_standings_date_idx on session_standings (scrim_date);

alter table session_standings enable row level security;

-- 표 자체는 공개하지 않는다. 읽기는 아래 뷰로만 나간다 (0004 방침: 공개할 것만
-- 명시적으로 연다). RLS 에 select 정책을 안 만들었으니 이것만으로도 막히지만,
-- public 스키마의 새 표에는 anon/authenticated select 가 기본으로 붙으므로
-- 0016 처럼 명시적으로 걷어낸다.
revoke select on session_standings from anon;
revoke select on session_standings from authenticated;

-- 0027 의 우승 기록을 standing = 1 로 옮긴다. 이 표가 우승 횟수의 새 출처가
-- 되므로, 옮기지 않으면 화면의 트로피가 전부 사라진다.
insert into session_standings
  (scrim_date, session_number, standing, team_no, member_id, source, note)
select scrim_date, session_number, 1, team_no, member_id, source, note
from session_wins
on conflict (scrim_date, session_number, member_id) do nothing;

-- 우승 횟수는 이제 여기서 센다. 뷰 이름과 컬럼이 그대로라 이걸 읽는 쪽
-- (lib/memberStats.ts, lib/rankingStats.ts)은 한 줄도 바뀌지 않는다.
create or replace view member_win_counts as
select member_id, count(*)::integer as win_count
from session_standings
where standing = 1
group by member_id;

grant select on member_win_counts to anon;
grant select on member_win_counts to authenticated;

-- 클랜원 화면의 "최근 N회 내전 종합등수" 줄이 읽을 뷰.
-- 0012 의 다른 뷰들처럼 뷰가 소유자 권한으로 도는 덕에 anon 이 session_standings
-- 를 직접 읽을 필요가 없다 — 그래서 표 자체에는 select 권한을 열지 않는다.
-- 판독 검산용 칸(team_no/place_points/kills/total_score)과 note 는 화면이 쓰지
-- 않으므로 내보내지 않는다.
create or replace view member_session_standings as
select member_id, scrim_date, session_number, standing
from session_standings;

grant select on member_session_standings to anon;
grant select on member_session_standings to authenticated;
