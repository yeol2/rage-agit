# dak.gg 내전 읽기 절차

PUBG API 는 플레이어의 매치 목록을 14일만 준다. 그보다 오래된 내전은
matchId 를 알 방법이 없어서 dak.gg 화면에서 읽는다.

**dak.gg 도 약 2개월치만 보관한다.** 그 전 내전은 어디에도 없다.

## 왜 반자동인가

에이전트가 페이지를 순회하며 클릭하게 만들면, dak.gg 가 클래스 이름 하나만
바꿔도 조용히 멈춘다. 그리고 그 사실을 데이터가 안 들어온 뒤에야 알게 된다.
관리자가 열고 에이전트가 읽으면 실패가 그 자리에서 드러난다.

## 관리자가 하는 일

1. 그 내전에 참가한 **아무나 한 명**의 dak.gg 전적 페이지를 연다.
   참가 인원이 4경기 내내 고정이라 한 명이면 그날 전체가 나온다.
2. 그 날짜의 경기마다 `상세` → `전체 순위` 를 누른다.
   추가 네트워크 요청 없이 참가자 전원의 지표가 화면에 나타난다.
3. 4경기를 전부 펼친 상태로 두고 에이전트에게 알린다.
   맵 이름과 경기 순서(위에서부터 1경기)도 같이 알려준다.

## 에이전트가 하는 일

1. 열려 있는 페이지에서 텍스트를 읽는다.
   `mcp__claude-in-chrome__get_page_text` 로 충분하다. 클릭하지 않는다.
2. 원문을 `data/dakgg-scrims/raw/YYYY-MM-DD.txt` 에 그대로 저장한다.
   나중에 파싱이 틀린 게 드러나도 페이지를 다시 열 필요가 없다.
3. `data/dakgg-scrims/YYYY-MM-DD.json` 을 아래 형식으로 쓴다.
4. `node scripts/import-dakgg-scrims.mjs --dry-run` 으로 형식을 검사한다.
   참가자 한 명의 칸 하나만 못 읽어도 여기서 누구의 어떤 칸인지 나온다.

## JSON 형식

한글 맵 이름을 **그대로 둔다.** 변환은 import 가 한다 — 파일이 화면과
같아야 관리자가 눈으로 대조할 수 있다.

- `timeSurvived` 는 초. 화면의 `27:06` 은 1626 이다.
- `totalDistance` 는 미터. 화면의 `6.47km` 는 6470 이다.
- `damageDealt` 는 화면 값 그대로(소수점 있으면 그대로).
- `teamRank` 는 `#1` 의 숫자.

```json
{
  "scrimDate": "2026-07-26",
  "source": "dakgg",
  "readAt": "2026-08-10T12:00:00+09:00",
  "readFrom": "Ez_Grim",
  "note": "저티어",
  "matches": [
    { "order": 1, "map": "미라마",
      "participants": [
        { "ign": "Ez_Grim", "teamRank": 3, "kills": 2, "headshotKills": 1,
          "assists": 0, "damageDealt": 412, "dbnos": 3,
          "totalDistance": 6472, "longestKill": 187, "timeSurvived": 1626 }
      ] }
  ]
}
```

## 특이사항 (저티어 내전 등)

그날 내전이 평소와 다른 형식이었으면(예: 저티어끼리만 모은 내전) `note` 필드에 적는다. 세션 제목이 `2026-06-14 (일) 내전` 대신 `2026-06-14 (일) 저티어 내전`으로 들어간다. 평소와 같으면 필드를 아예 뺀다.

## 적재 뒤 미확인 닉네임 처리

`node scripts/verify-dakgg-import.mjs` 가 "클랜원으로 연결 안 된 닉네임"을 보여준다. 순서대로:

1. **`node scripts/apply-departed-members.mjs` 를 먼저 돌린다.** `data/departed-members.tsv` 에 이미 확인된 탈퇴자 목록이 있다 — 같은 닉네임이 새 내전에 또 나오면 관리자에게 다시 묻지 않고 자동으로 지운다.
2. 그래도 남는 닉네임만 관리자에게 묻는다. 부계정/개명이면 `scripts/link-alt-account.mjs` → `scripts/relink-participants.mjs`, 탈퇴자면 `data/departed-members.tsv` 에 한 줄 추가하고 `apply-departed-members.mjs` 를 다시 돌린다(그러면 이번 것도 지워지고, 다음에도 자동으로 걸린다).

## 없는 것

`heals`(회복) `boosts`(부스터) `revives`(소생) 는 dak.gg 표에 칸이 없다.
JSON 에 넣지 않는다. DB 에는 `NULL` 로 들어간다 — 0 이 아니다.

## dak.gg 가 주는 칸은 전부 읽는다

당장 쓰는 지표가 6개뿐이어도 10칸을 다 읽어 저장한다. 저장 비용은 0 이고,
2개월이 지나면 그 페이지는 사라져서 다시 읽을 방법이 없다.
