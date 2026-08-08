# 클랜원 등록 (Supabase 스키마) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **이 플랜은 순수 코드 태스크와 사람만 할 수 있는 태스크가 섞여 있다.** Task 2와 Task 3은 Supabase 웹 대시보드에서 직접 하는 작업이라 코딩 서브에이전트에게 디스패치할 대상이 아니다 — 컨트롤러(사람 또는 조정 에이전트)가 직접 안내하거나 수행한다. Task 1, 4는 일반적인 코드 태스크다.

**Goal:** `clans`/`members`/`member_pubg_accounts` 3개 테이블을 실제 Supabase 프로젝트에 만들고, 관리자가 Table Editor로 클랜원(멀티 IGN 포함)을 등록한 뒤, 앱에서 그 데이터가 실제로 읽히는지 검증한다.

**Architecture:** 스키마는 SQL 마이그레이션 파일로 저장소에 남기고 Supabase SQL Editor에 붙여넣어 적용한다(CLI 불필요). 검증은 `@supabase/supabase-js`로 anon key를 사용해 조회하는 Node 스크립트로 한다 — 기존 `scripts/test-pubg-api.mjs` 패턴과 동일하게, `.env.local`을 읽고 결과를 사람이 읽기 좋게 출력한다.

**Tech Stack:** Supabase (Postgres, RLS), `@supabase/supabase-js`, Node.js 스크립트 (Vitest 대상 아님 — 실제 네트워크/DB 호출이라 순수 함수가 아니다)

## Global Constraints

- 테이블 3개, 정확히 이 이름과 컬럼: `clans`(id, name, created_at), `members`(id, clan_id, discord_nickname, tier, is_active, created_at, updated_at), `member_pubg_accounts`(id, member_id, pubg_ign, pubg_account_id, created_at).
- `members.discord_nickname`은 `clan_id`와 묶어 unique. `member_pubg_accounts.pubg_ign`은 전역 unique (PUBG IGN은 시스템 전체에서 유일).
- `tier`는 `numeric(3,1)`, 기본값 0. 가능한 값: 0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5.
- 세 테이블 모두 RLS를 켜고, `select`만 공개(`using (true)`) 정책을 추가한다. INSERT/UPDATE/DELETE 정책은 만들지 않는다.
- 클랜원 등록은 Supabase Table Editor에서 관리자가 직접 한다 — 이번 범위에 `/admin` 페이지를 만들지 않는다.
- 매치 폴링, 내전 판별, 대시보드 실데이터 연동은 이번 플랜 범위 밖이다(각각 2~4단계, 별도 플랜).

---

### Task 1: 마이그레이션 SQL 작성

**Files:**
- Create: `supabase/migrations/0001_member_registration.sql`

**Interfaces:**
- Produces: `clans`, `members`, `member_pubg_accounts` 테이블 정의 (Global Constraints의 스키마 그대로). Task 2에서 이 파일을 Supabase SQL Editor에 그대로 붙여넣어 실행한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0001_member_registration.sql`:
```sql
-- 클랜원 등록 스키마 (1단계): clans, members, member_pubg_accounts
-- 한 사람(디스코드 정체성)이 여러 PUBG IGN을 가질 수 있도록 1:N으로 분리했다.

create table clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id),
  discord_nickname text not null,
  tier numeric(3,1) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, discord_nickname)
);

create table member_pubg_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  pubg_ign text not null,
  pubg_account_id text,
  created_at timestamptz not null default now(),
  unique (pubg_ign)
);

alter table clans enable row level security;
alter table members enable row level security;
alter table member_pubg_accounts enable row level security;

create policy "clans_select_public" on clans for select using (true);
create policy "members_select_public" on members for select using (true);
create policy "member_pubg_accounts_select_public" on member_pubg_accounts for select using (true);
```

- [ ] **Step 2: 문법 정적 확인**

이 단계는 실제 DB 없이는 실행 검증이 안 된다(적용은 Task 2에서 사람이 Supabase SQL Editor로 한다). 대신 파일을 다시 읽고 다음을 눈으로 확인한다:
- 세미콜론이 각 statement 끝에 있는가
- 외래키(`references`)가 먼저 정의된 테이블만 참조하는가 (`clans` → `members` → `member_pubg_accounts` 순서)
- 정책 이름에 오타가 없는가 (Global Constraints의 이름과 정확히 일치)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0001_member_registration.sql
git commit -m "feat: add member registration schema migration"
```

---

### Task 2: 사용자 작업 — Supabase에 스키마 적용 + 접속 정보 확보

**이 태스크는 코딩 서브에이전트에게 디스패치하지 않는다.** Supabase 웹 대시보드 조작이 필요해서 사람(또는 브라우저 도구를 가진 조정 에이전트)이 직접 한다.

**Files:** 없음 (Supabase 프로젝트 상태 + `.env.local` 변경)

**Interfaces:**
- Consumes: Task 1의 `supabase/migrations/0001_member_registration.sql`
- Produces: `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 값. Task 4의 검증 스크립트가 이 두 값을 읽는다.

- [ ] **Step 1: 스키마 적용**

Supabase 대시보드 → 프로젝트(RageClan) → 좌측 메뉴 **SQL Editor** → New query. `supabase/migrations/0001_member_registration.sql` 파일 내용을 그대로 붙여넣고 **Run**.

Expected: "Success. No rows returned" 메시지. 좌측 **Table Editor**로 이동하면 `clans`, `members`, `member_pubg_accounts` 세 테이블이 보인다.

- [ ] **Step 2: API 접속 정보 확보**

Supabase 대시보드 → **Project Settings** → **API**. 다음 두 값을 복사한다:
- **Project URL** (예: `https://xxxxxxxxxxxx.supabase.co`)
- **anon public** key (긴 JWT 문자열)

- [ ] **Step 3: `.env.local`에 추가**

`.env.local` 파일을 열어 다음 두 줄을 추가한다 (기존 `PUBG_API_KEY=...`, `SUPABASE_DATABASE_PASSWORD=...` 줄은 그대로 둔다):
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL 붙여넣기>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key 붙여넣기>
```

`.env.local`은 이미 `.gitignore`에 등록돼 있어 커밋되지 않는다. 여기서는 별도 커밋 없음.

---

### Task 3: 사용자 작업 — 클랜원 목업 데이터 등록

**이 태스크도 코딩 서브에이전트에게 디스패치하지 않는다.** Supabase Table Editor에서 관리자가 직접 데이터를 입력한다.

**Files:** 없음 (Supabase 테이블 데이터)

**Interfaces:**
- Consumes: Task 2에서 적용된 테이블
- Produces: 최소 2명의 `members` 행, 그중 1명은 `member_pubg_accounts`에 2개 이상의 IGN — Task 4의 검증 스크립트가 이 데이터를 읽어서 멀티 IGN 케이스가 제대로 묶이는지 확인한다.

- [ ] **Step 1: 클랜 등록**

Table Editor → `clans` 테이블 → Insert row:
- `name`: `RAGE`

생성된 행의 `id`(uuid)를 복사해둔다 — 다음 스텝에서 `clan_id`로 쓴다.

- [ ] **Step 2: 클랜원 등록 (멀티 IGN 케이스 포함)**

Table Editor → `members` 테이블 → Insert row를 2번 이상 반복:

행 1 (멀티 IGN 케이스):
- `clan_id`: 위에서 복사한 clans의 id
- `discord_nickname`: `Ez_Code`
- `tier`: `3`
- `is_active`: `true`

행 2 (실제 다른 클랜원 아무나):
- `clan_id`: 동일
- `discord_nickname`: (실제 디스코드 닉네임)
- `tier`: (실제 티어)
- `is_active`: `true`

각 행 생성 후 `id`를 복사해둔다.

- [ ] **Step 3: PUBG 계정 매핑 등록**

Table Editor → `member_pubg_accounts` 테이블 → Insert row:

행 1: `member_id` = 위 "행 1"의 id, `pubg_ign` = `Ez_Code`
행 2: `member_id` = 위 "행 1"의 id, `pubg_ign` = `Ez_Codu`
행 3: `member_id` = 위 "행 2"의 id, `pubg_ign` = (그 클랜원의 실제 PUBG IGN)

`pubg_account_id`는 비워둬도 된다(2단계 폴링에서 채울 예정).

---

### Task 4: 검증 스크립트 작성

**Files:**
- Create: `scripts/verify-supabase-schema.mjs`
- Modify: `package.json` (의존성 추가)

**Interfaces:**
- Consumes: Task 2의 `.env.local` 값(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), Task 3에서 등록된 실제 데이터
- Produces: 없음 (읽기 전용 검증 스크립트, 이후 태스크가 이 파일을 가져다 쓰지 않는다)

- [ ] **Step 1: 의존성 설치**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: 스크립트 작성**

`scripts/verify-supabase-schema.mjs`:
```js
// Supabase 스키마 검증 스크립트.
// 사용법: node scripts/verify-supabase-schema.mjs
//
// .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 읽어서
// clans/members/member_pubg_accounts 가 실제로 조회되는지, 특히 한 사람이
// 여러 PUBG IGN을 가진 케이스가 제대로 묶이는지 확인한다.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const content = readFileSync('.env.local', 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local이 없으면 무시 (환경변수로 직접 넘겼을 수도 있음)
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('.env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data: clans, error: clansError } = await supabase.from('clans').select('*');
if (clansError) {
  console.error('clans 조회 실패:', clansError.message);
  process.exit(1);
}
console.log(`clans: ${clans.length}개`);
for (const clan of clans) {
  console.log(`  - ${clan.name} (${clan.id})`);
}

const { data: members, error: membersError } = await supabase
  .from('members')
  .select('id, discord_nickname, tier, is_active, member_pubg_accounts(pubg_ign, pubg_account_id)');
if (membersError) {
  console.error('members 조회 실패:', membersError.message);
  process.exit(1);
}

console.log(`\nmembers: ${members.length}명`);
for (const member of members) {
  const igns = member.member_pubg_accounts.map((a) => a.pubg_ign).join(', ');
  console.log(`  - ${member.discord_nickname} (티어 ${member.tier}) — IGN: ${igns || '(없음)'}`);
}

const multiIgnMembers = members.filter((m) => m.member_pubg_accounts.length > 1);
console.log(`\n여러 IGN을 가진 멤버: ${multiIgnMembers.length}명`);
for (const m of multiIgnMembers) {
  console.log(`  - ${m.discord_nickname}: ${m.member_pubg_accounts.map((a) => a.pubg_ign).join(', ')}`);
}
```

- [ ] **Step 3: 실행**

Run: `node scripts/verify-supabase-schema.mjs`

Expected:
- `clans: 1개` 아래 `RAGE`가 출력된다.
- `members: 2명`(Task 3에서 등록한 수만큼) 아래 각 멤버의 티어와 IGN 목록이 출력된다.
- `여러 IGN을 가진 멤버: 1명` 아래 `Ez_Code: Ez_Code, Ez_Codu`가 출력된다 — 이게 나오면 멀티 IGN 구조가 실제로 동작하는 것이다.

에러가 나면(`clans 조회 실패` 등) Task 2의 `.env.local` 값이 맞는지, Task 1의 RLS 정책이 제대로 적용됐는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json scripts/verify-supabase-schema.mjs
git commit -m "feat: add Supabase schema verification script"
```
