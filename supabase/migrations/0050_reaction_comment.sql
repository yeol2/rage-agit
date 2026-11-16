-- 반응속도 랭킹 한 줄 평(2026-11-16 사용자 요청). 등록할 때 선택으로 쓰고, 최고 기록과 함께 남는다
-- (기록을 깨면 새 한 줄 평으로 바뀌고, 못 깨면 그대로). 빈칸은 null.
-- 랭킹 한 줄에 들어가야 해서 20자까지 — 서버 라우트도 같은 길이로 먼저 거른다.
alter table reaction_records add column if not exists comment text;

alter table reaction_records drop constraint if exists reaction_records_comment_length;
alter table reaction_records add constraint reaction_records_comment_length
  check (comment is null or char_length(comment) between 1 and 20);
