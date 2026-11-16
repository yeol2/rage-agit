-- 반응속도 랭킹 — 최고 기록이 몇 번째 판에서 나왔는지(2026-11-16 사용자 요청). 5회 기록 드롭다운에 보여준다.
-- 판 수는 브라우저가 센다(1회차부터 새로 시작할 때마다 +1, 실패해서 다시 하는 것도 포함). 기기를 바꾸면
-- 다시 세므로 참고용이다. 이 칸이 생기기 전 기록은 null.
alter table reaction_records add column if not exists best_try integer;

alter table reaction_records drop constraint if exists reaction_records_best_try_positive;
alter table reaction_records add constraint reaction_records_best_try_positive
  check (best_try is null or best_try between 1 and 1000000);
