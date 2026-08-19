-- VIP 등수 — 내전 펀딩을 많이 하거나 VIP 명단에 있는 클랜원에게 부여한다.
-- 한 사람당 등수 하나뿐인 1:1 속성이라 별도 테이블 없이 members 에 컬럼 하나로 둔다.
-- VIP 로 표시된다고 그 사람의 실제 클랜 티어(tier)를 바꾸거나 지우지 않는다 —
-- 클랜원 목록에는 원래 티어 섹션에도 그대로 나오고, VIP 섹션에도 추가로 나온다
-- (의도된 중복 표시).

alter table members add column if not exists vip_rank integer;

-- 등수는 1등부터 시작하는 양수, 그리고 클랜 안에서 유일해야 한다(같은 등수 두 명 방지).
-- null 은 유일 인덱스에서 자동으로 제외되므로 VIP 아닌 사람은 걱정 없다.
alter table members drop constraint if exists members_vip_rank_positive;
alter table members add constraint members_vip_rank_positive check (vip_rank is null or vip_rank > 0);

create unique index if not exists members_clan_vip_rank_key
  on members (clan_id, vip_rank)
  where vip_rank is not null;

-- 0004 방침대로 새 컬럼은 명시적으로 열어야 anon/authenticated 로 읽힌다 —
-- 클랜원 목록 맨 위 VIP 섹션에서 공개적으로 보여줄 값이라 열어준다.
grant select (id, clan_id, discord_nickname, tier, is_active, vip_rank, created_at, updated_at)
  on members to anon;
grant select (id, clan_id, discord_nickname, tier, is_active, vip_rank, created_at, updated_at)
  on members to authenticated;
