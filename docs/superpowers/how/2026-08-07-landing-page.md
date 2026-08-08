# How: 랜딩페이지

**스펙**: [2026-08-07-landing-page-design.md](../specs/2026-08-07-landing-page-design.md)
**브랜치**: `feature/landing-page` → `master` (로컬 병합, 원격 없음)
**커밋 범위**: `dddcacc..0bf1aec`

## 진행 순서

1. **브레인스토밍** — `brainstorming` 스킬로 랜딩페이지 방향(단일 히어로, mapleaudit.com 톤, PUBG 맵 3D 포인트클라우드 배경 아이디어) 정리 후 스펙 문서 작성.
2. **구현 계획 + 서브에이전트 실행 (1차 시도, 폐기됨)** — `writing-plans` → `using-git-worktrees`(`worktree-landing-page`) → `subagent-driven-development`로 9개 태스크 진행, 태스크별 구현·리뷰까지 마쳤음. 브라우저 수동 검증(Task 9) 중 react-three-fiber `<Canvas>`의 인라인 스타일이 Tailwind `absolute` 클래스를 덮어써 히어로가 뷰포트 밖으로 밀리는 실제 버그를 발견해 수정하던 중, **사용자가 "너무 오래 걸린다, variant에 다시 물어보겠다"며 작업 전체를 취소** — 워크트리·브랜치·구현 계획 문서를 전부 삭제(디자인 스펙과 이미지만 유지).
3. **디자인 반복 (variant 사용)** — 이후 여러 차례 variant(외부 AI 디자인 도구)에 넣을 프롬프트를 함께 다듬음 (컬러 팔레트, 3D 포인트클라우드 배경, 로고 이미지, 참고 사이트 레이아웃 등). 이 단계는 코드 작업이 아니라 프롬프트 작성 지원.
4. **직접 구현으로 전환** — variant 결과물이 마음에 안 들어 "스크린샷 보고 내가 직접 만들어줄래" 요청. 이번엔 서브에이전트 없이 이 세션에서 직접 Next.js 스캐폴딩부터 Nav/Hero/Features/Footer 컴포넌트까지 구현. `npx tsc --noEmit` + `npm run build` + 브라우저(Claude_Browser 도구)로 매 변경마다 검증.
5. **다듬기 라운드 다수** — 밑줄 제거, Pretendard 폰트 실제 적용(처음엔 CSS에 이름만 있고 로드가 안 되던 버그 발견·수정), 네비 글자 크기/중앙정렬, 참여자 수 표기, 푸터 구조(참고 이미지 기준 2열), `RAGE AGIT` 워드마크 폰트 굵기·자간 등을 사용자 피드백 받아가며 반복 수정.
6. **마무리** — `finishing-a-development-branch` 스킬로 `master`에 로컬 fast-forward 병합, `feature/landing-page` 브랜치 삭제.

## 특이사항 / 배운 점

- **1차 시도 폐기**: 서브에이전트 방식이 항상 최선은 아니다 — 사용자가 속도를 우선할 때는 직접 구현이 더 적합했다.
- **프리뷰 패널 렌더링 버그**: 이 세션 내내 브라우저 프리뷰 패널이 "displayed 안 됨" 스크린샷 실패를 반복했고, 실제 스크롤 시 검은 화면이 나타나는 문제도 있었다. 원인은 앱 코드(clip-path 등)가 아니라 프리뷰 패널 자체의 컴포지팅/리페인트 문제로 확인됨(리사이즈하면 복구). 실제 스크롤 제스처로는 문제 없었음.
- **`npm run dev`가 켜진 상태에서 `npm run build`를 돌리면 `.next` 산출물이 꼬여 CSS 전체가 깨진다** — 이후로는 dev 서버가 떠 있을 때 build를 돌리지 않거나, 문제가 생기면 `.next` 삭제 후 재시작.
- **폰트가 "적용된 것처럼 보이지만 실제로는 로드 안 됨"**: CSS에 `font-family` 이름만 적어두는 것과 실제로 `@import`/`@font-face`로 로드하는 것은 다르다 — `document.fonts.check()`나 실제 렌더 폭 비교로 검증해야 확실하다.
