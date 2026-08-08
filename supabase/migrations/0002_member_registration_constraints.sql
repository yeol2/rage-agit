-- 0001에 대한 최종 리뷰에서 발견된 이슈 수정: pubg_account_id 유일성 보장,
-- members.updated_at 자동 갱신 트리거 추가.

alter table member_pubg_accounts add constraint member_pubg_accounts_pubg_account_id_key unique (pubg_account_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger members_set_updated_at
  before update on members
  for each row
  execute function set_updated_at();
