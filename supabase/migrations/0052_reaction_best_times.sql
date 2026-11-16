-- 반응속도 랭킹 — 최고 기록의 5회 회차 기록(2026-11-16 사용자 요청). 랭킹 줄 끝 드롭다운에 보여준다.
-- 최고 기록을 깰 때 그 판의 5회를 같이 저장한다. 이 칸이 생기기 전 기록은 null(회차 기록 없음).
alter table reaction_records add column if not exists best_times integer[];

alter table reaction_records drop constraint if exists reaction_records_best_times_len;
alter table reaction_records add constraint reaction_records_best_times_len
  check (best_times is null or array_length(best_times, 1) = 5);
