# PUBG Open API 참고 문서

> 실제 키로 호출해본 결과(`scripts/test-pubg-api.mjs`, `scripts/inspect-matches.mjs`)와 공식 문서(`documentation.pubg.com`)를 합쳐서 정리했다. "실측"이라고 표시된 항목은 코드를 짤 때 그대로 믿어도 되고, 아닌 항목은 문서만 보고 적은 것이라 실제로 다시 확인이 필요할 수 있다.

## 기본 정보

- 단일 통합 API다. "카카오 API"가 따로 있는 게 아니라, 플랫폼을 `shard`로 지정한다: `https://api.pubg.com/shards/kakao/...`
- 인증: `Authorization: Bearer <API_KEY>`, `Accept: application/vnd.api+json`
- 발급: [developer.pubg.com](https://developer.pubg.com) → MY APPS
- 지원 shard: `kakao`, `steam`, `psn`, `xbox`, `stadia`, `console`, `tournament`

## 속도 제한 (실측)

- **Players 등 대부분 엔드포인트**: 분당 10회. 최대 10명까지 배치 조회 가능해서 요청 수를 아낄 수 있다.
- **Matches, Telemetry**: 속도 제한 **없음** (실측 — 연달아 26회 호출해도 문제없었다).
- **플레이어 이름은 대소문자를 구분한다** (실측 — `Ez_Code`는 되고 `ez_code`/`EZ_CODE`는 404).

## 데이터 보존 기간

플레이어의 "최근 매치 목록"은 **14일**만 제공된다. 그 이전 매치는 그 플레이어의 목록에서 사라진다 — 우리 쪽에서 주기적으로 폴링해 DB에 쌓아두지 않으면 예전 내전 기록이 유실된다. (이건 처음 MVP 스펙에서 이미 리스크로 적어뒀던 내용과 일치한다.)

## 엔드포인트별 제공 데이터

### 1. Players

```
GET /shards/kakao/players?filter[playerNames]=Ez_Code,Foo,Bar
```

- `data[].id` — accountId
- `data[].attributes.name` — 정확한 표기의 닉네임
- `data[].relationships.matches.data[]` — 최근 매치 ID 목록 (14일치)

**우리가 쓸 것**: accountId 확보, 최근 matchId 목록.

### 2. Matches (실측)

```
GET /shards/kakao/matches/{matchId}
```

`data.attributes`:

| 필드 | 값 (실측 예시) | 용도 |
|---|---|---|
| `matchType` | `competitive`, `custom` | 내전 후보 필터 |
| `isCustomMatch` | `true`/`false` | `matchType`과 이중 확인 |
| `gameMode` | `squad`(경쟁전), `esports-squad`(커스텀) | 보조 필터 신호 |
| `mapName` | `Baltic_Main`, `Desert_Main` 등 | 참고 표시용 |
| `duration` | 초 단위 (예: 1624) | 참고 표시용 |
| `createdAt` | ISO 타임스탬프 | 내전 날짜/시간 군집화에 사용 |

`included` 배열에 세 종류가 섞여 온다 (실측: 커스텀 매치 하나에 `roster` 16개, `participant` 64개, `asset` 1개 — 4인 스쿼드 16팀 = 64명, "보통 64명"이라던 값과 실제로 일치했다):

**roster** (팀 단위)
- `attributes.stats.rank` — 팀 순위
- `attributes.won` — 우승 여부
- `relationships.participants.data[]` — 이 팀 소속 참가자 4명

**participant** (개인 단위) — `attributes.stats`:

| 필드 | 의미 |
|---|---|
| `kills` | 킬 수 |
| `assists` | 어시스트 |
| `damageDealt` | 가한 데미지 |
| `DBNOs` | 다운시킨 횟수 |
| `headshotKills` | 헤드샷 킬 |
| `winPlace` | 개인 최종 순위 |
| `killPlace` | 킬 기준 순위 |
| `timeSurvived` | 생존 시간(초) |
| `heals`, `boosts` | 회복/부스트 아이템 사용 수 |
| `longestKill` | 최장 킬 거리 |
| `revives` | 부활시킨 횟수 |
| `walkDistance`, `rideDistance`, `swimDistance` | 이동 거리 |
| `weaponsAcquired` | 획득 무기 수 |
| `name`, `playerId` | 닉네임, accountId (매치 안 참가자 식별용) |

**asset** (텔레메트리)
- `attributes.URL` — 상세 이벤트 로그 JSON 파일 링크 (`telemetry-cdn.pubg.com`, PUBG API가 아니라 별도 CDN)
- 초 단위로 착지/킬/힐/자기장 축소 등 모든 이벤트가 담겨있다. 용량이 크고 매치마다 별도 요청이 필요하다.

**우리가 지금 쓸 것**: `matchType`/`isCustomMatch`(내전 필터), `gameMode`(보조 필터), `createdAt`(날짜/군집화), `roster` 개수(참여인원=팀수×4, 경기수), `participant.stats`의 `kills`/`damageDealt`/`winPlace`/`timeSurvived`(대시보드 통계).

**당장 안 쓰는 것**: 텔레메트리 전체, `weaponsAcquired`/`rideDistance` 같은 세부 이동 통계 — 필요해지면 그때 추가.

### 3. Samples (아직 테스트 안 해봄)

플레이어 이름 없이 플랫폼별 무작위 최근 매치를 받아온다(24시간마다 갱신). 우리는 이미 클랜원 명단이 있어서 Players로 시작하면 되므로, 이번 프로젝트에서는 쓸 일이 없을 것 같다.

## matchType 값 정리

- `competitive` — 일반 경쟁전 랭크 매치 (실측 확인)
- `custom` — 커스텀 매치 (실측 확인). **우리 내전과 남의 모임이 모두 여기 들어온다** — 아래 "우리 내전을 가려내는 유일한 신호" 절 참고.
- 문서에는 이 외에 `airoyale`, `arcade`, `event`, `official`, `seasonal`, `training`도 나오지만 아직 실측해보지 않았다.

## 중요한 실전 발견: `custom` ≠ "우리 클랜 내전"

실측 플레이어(`Ez_Code`)의 최근 26경기 중 `custom` 9개가 **일요일(4경기)뿐 아니라 금요일(5경기)에도** 있었다. 즉 `matchType === 'custom'`만으로는 "우리 클랜 정기 내전"을 특정할 수 없고, 개인 연습·다른 모임 커스텀이 섞일 수 있다. [대시보드 세션](sessions/2026-08-08-대시보드/대시보드.md)을 설계할 때 이미 예상했던 문제이고, 원래 MVP 스펙에서 정한 "시간 군집화 + 등록된 클랜원 참여 인원 임계치" 로직이 실제로 필요하다는 게 실측으로 확인됐다.

## 관전자는 매치 기록을 남기지 않는다 (실측)

모든 내전에 관전으로 들어가는 계정(`Ez_Rage-`)을 기준점으로 쓰면 Players 호출 한 번으로 끝나겠다고 기대했으나 **불가능하다.** 그 계정의 최근 매치 174개가 전부 `competitive`이고 커스텀은 0개였다. 같은 기간 `Ez_Code`에게는 커스텀 9경기가 잡혔으므로 내전은 분명히 있었다.

관전 슬롯은 참가자로 기록되지 않아 그 사람의 매치 목록에 아예 올라오지 않는다. **matchId는 실제로 뛴 사람을 통해서만 얻을 수 있다.**

## 보존 기간 14일 확인 (실측)

`Ez_Rage-`의 매치 목록에서 가장 오래된 매치가 조회 시점(2026-08-09)으로부터 정확히 14일 전인 2026-07-26이었다.

실제로 폴링을 처음 돌렸을 때 07-26 내전은 4경기 중 2경기만 남아 있었다. **경계에 걸린 날은 이미 일부가 사라진 뒤다.**

## accountId 로도 조회된다 (실측)

```
GET /shards/kakao/players?filter[playerIds]=account.xxx,account.yyy
```

`filter[playerNames]`와 같은 형태로 응답한다. **닉네임은 바뀌지만 accountId는 안 바뀌므로 폴링에는 이쪽을 쓴다.** (클랜원 등록 과정에서 디스코드 별명과 실제 IGN이 다른 사례가 여럿 확인됐다.)

## 우리 내전을 가려내는 유일한 신호는 등록 클랜원 비율 (실측)

`Ez_Code`의 커스텀 9경기가 두 날에 걸쳐 있었는데, 관리자 확인 결과 **07-31 5경기는 우리 내전이 아니었다.** 두 날의 겉모습은 완전히 같다:

| | 07-31 (내전 아님) | 08-02 (내전) |
|---|---|---|
| `matchType` | `custom` | `custom` |
| `gameMode` | `esports-squad` | `esports-squad` |
| 참가자 / 팀 | 64명 / 16팀 | 64명 / 16팀 |
| **등록 클랜원** | **15명 (23%)** | **63명 (98%)** |

`matchType`·`gameMode`·참가자 수 어느 것도 판별력이 없다. 참가자 수는 특히 쓸 수 없는데, **내전 인원이 50~70명으로 변동하기 때문이다** — 실제로 07-26 내전은 68명(17팀)이었다.

## 내전의 형태 (관리자 확인 + 실측)

- 하루 **4경기**로 고정이다. 저장된 경기가 4개가 안 되면 놓친 것이다.
- 그날 정해진 인원(50~70명)이 4경기를 그대로 함께 뛴다.
- 주 2일 진행한다.

## 우리 설계와의 매핑

| 우리 개념 | API 필드/방법 |
|---|---|
| 클랜원 등록 (IGN) | Players 조회용 정확한 닉네임 (대소문자 구분) |
| 매치 발견 (폴링) | `filter[playerIds]` 로 최근 내전 참가자 조회 — 관전 계정은 쓸 수 없다 |
| 내전 후보 매치 | `matchType === 'custom'` |
| 우리 클랜 내전만 특정 | **등록 클랜원 비율 50% 이상 + 참가자 40명 이상** (실측: 98% 대 23%로 갈린다) |
| 참여 인원 / 경기 수 | `roster` 개수 × 4, 해당 세션에 묶인 매치 개수 |
| 개인 통계 (킬/데미지/순위/생존율) | `participant.attributes.stats`의 `kills`/`damageDealt`/`winPlace`/`timeSurvived` |
| 다시보기 링크 | API에 없음 — 관리자 수동 입력 유지 |
| 클랜원 식별 (디스코드 vs PUBG) | API가 모름 — 관리자가 `discordNickname` ↔ `pubgIgn` 수동 매핑 |

## 미확인 / 추가 조사 필요

- Seasons, Leaderboards 엔드포인트 — 아직 안 봄
- 텔레메트리 실제 페이로드 구조 — 필요해지면 그때 열어보기
- `official`/`event`/`seasonal` 등 나머지 `matchType` 값 — 실측 못함
