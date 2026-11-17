-- 반응속도 — 회차마다 서버 확인(2026-11-17 사용자 요청, "게임 없이 숫자만 보내기" 막기).
-- 초록불이 켜질 때 'green', 클릭할 때 'click' 신호를 회차별 무작위 번호(nonce)와 함께 보내고,
-- 서버가 도착 시각을 여기에 적는다. 등록할 때 브라우저가 보고한 반응 시간을 서버가 잰 간격과 비교한다.
-- 서버 라우트(service role)만 읽고 쓴다 — anon 정책 없음. 하루 지난 줄은 등록 때 지운다.
create table if not exists reaction_round_pings (
  nonce text primary key check (char_length(nonce) between 16 and 64),
  run_id text not null,
  green_at timestamptz,
  click_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reaction_round_pings_created_idx on reaction_round_pings (created_at);

alter table reaction_round_pings enable row level security;
