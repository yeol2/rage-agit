-- 반응속도 한 줄 평 길이 20자 → 30자(2026-11-16 사용자 결정). lib/reaction.ts COMMENT_MAX_CHARS 와 같다.
alter table reaction_records drop constraint if exists reaction_records_comment_length;
alter table reaction_records add constraint reaction_records_comment_length
  check (comment is null or char_length(comment) between 1 and 30);
