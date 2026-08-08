# How: 대시보드 페이지

**스펙**: [2026-08-08-dashboard-design.md](../specs/2026-08-08-dashboard-design.md)
**플랜**: [2026-08-08-dashboard.md](../plans/2026-08-08-dashboard.md)
**브랜치**: `feature/dashboard` → `worktree-dashboard`(격리 작업) → `master` (로컬 병합, 원격 없음)
**커밋 범위**: `ddfab4e..4b6563f`

## 진행 순서

1. **브레인스토밍** — `brainstorming` 스킬. 참고 이미지 2장(PKGG Season Awards 스타일 시상대 랭킹, PUBG e스포츠 대회 목록)을 우리 내전 규모에 맞게 축소하는 방향으로 질문을 주고받으며 확정:
   - 백엔드 없음 → UI만 먼저, 실제 데이터 구조와 동일한 목업으로 진행
   - 랭킹은 종합점수 하나 + 티어 그룹(전체/0~1.5/2~2.5/3~3.5/4~4.5) Top3 포디움, 티어는 관리자 수동 지정
   - 다시보기 링크는 관리자가 URL 수동 입력 (PUBG API에 영상 데이터 없음)
   - 범위는 이번엔 메인 화면까지만, 멤버 상세 페이지는 다음으로 미룸
   - 최근 내전 10개, 참여인원·경기수·다시보기 표시
2. **선행 정리**: 브레인스토밍 도중 사용자가 "`feature/landing-page`를 먼저 `master`에 합치고 대시보드 브랜치를 새로 파자"고 요청 → `finishing-a-development-branch` 스킬로 병합·정리 후 `feature/dashboard` 브랜치 생성.
3. **구현 계획** — `writing-plans` 스킬로 6개 태스크 작성 (목업 데이터+테스트 인프라 → 포디움 → 내전 목록 → Nav/Footer `ready` 플래그 연결 → 페이지 조합 → 브라우저 수동 검증).
4. **격리 워크스페이스** — `using-git-worktrees` 스킬로 `worktree-dashboard` 브랜치 생성 (네이티브 `EnterWorktree` 도구 사용, `.claude/worktrees/dashboard`).
5. **서브에이전트 실행** — `subagent-driven-development` 스킬로 태스크별 진행. **이 저장소 최초의 테스트 인프라(Vitest + React Testing Library)를 이 작업에서 처음 도입**했다.

   | 태스크 | 내용 | 리뷰 결과 |
   |---|---|---|
   | 1 | 목업 데이터·순수 로직 + Vitest 인프라 | 리뷰 클린 (9 tests) |
   | 2 | 티어 랭킹 포디움 | 리뷰 클린 |
   | 3 | 최근 내전 목록 | 리뷰 클린 |
   | 4 | Nav/Footer `ready` 플래그 연결 | 리뷰 클린 |
   | 5 | 대시보드 페이지 조합 | 리뷰 클린 |
   | 6 | 브라우저 수동 검증 | 탭 전환·빈 슬롯·반응형·회귀 전부 확인 |

   최종 24개 테스트 전부 통과, 프로덕션 빌드 성공.
6. **최종 전체 리뷰** — 브랜치 전체 diff를 대상으로 최종 코드 리뷰 진행, 5건 지적 후 수정:
   - 대시보드 카피가 컴포넌트에 하드코딩돼 있던 것 (랜딩페이지는 전부 `siteConfig`에서 가져오는 원칙이 깨져 있었음) → `siteConfig.dashboard`로 이동
   - `<h1>` 및 페이지 `<title>` 누락
   - 포디움 빈 순위 배지가 스펙대로 흐려지지 않던 문제
   - 정렬·개수 제한(Top3) 로직이 컴포넌트에 빠져 있던 부분
   - (5번째 항목은 재검토 통과로 마무리, 커밋 `4b6563f`)
7. **병합** — 워크트리에서 테스트/빌드 재확인 → `master`로 fast-forward 병합 → 워크트리·브랜치(`worktree-dashboard`, `feature/dashboard`) 정리.

## 특이사항 / 배운 점

- **워크트리를 지우지 않고 두면 테스트가 오염된다**: 병합 후 워크트리(`.claude/worktrees/dashboard`)를 남겨뒀더니, 그 안의 별도 `node_modules`(자체 React 사본)를 Vitest가 함께 스캔하면서 `recoverFromConcurrentError`(React 중복 로드) 에러로 테스트가 깨졌다. `git worktree remove`로 지우자 즉시 해결됨 — **작업이 끝난 워크트리는 병합 직후 반드시 제거**.
- **이전 세션(랜딩페이지)의 교훈을 이번 태스크 브리핑에 직접 반영**: `vitest.setup.ts`에서 `globals: true` 없이 `@testing-library/jest-dom/vitest` 서브패스를 쓰는 규칙을 Task 1 디스패치 프롬프트에 명시해, 이전에 겪었던 동일한 실수를 처음부터 피함.
- **목업 데이터의 요일 계산**: `formatScrimDate`에서 `new Date(isoString)`처럼 로컬 타임존에 의존하는 파싱 대신 `Date.UTC(...)`로 직접 구성해 타임존에 따른 요일 밀림 버그를 방지. 테스트 케이스의 요일도 직접 계산(Zeller's congruence)해서 검증.
