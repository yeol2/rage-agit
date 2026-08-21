// item.badgeLabel 이 일부 항목에만 있으면 TS가 유니언 타입에서 접근을 막는다 —
// 명시적으로 타입을 줘서 모든 항목에 선택 필드로 존재하게 만든다.
interface FeatureItem {
  title: string;
  body: string;
  ready: boolean;
  badgeLabel?: string;
}

// 실제로 만든 순서대로: 자동 집계 → 랭킹 → 매치 기록 → 내전 팀 구성이 이미 돌아가고
// 있다. 클랜원 페이지는 절반쯤 만들어져 있어 COMING SOON과 구분되는
// badgeLabel("제작중")을 따로 준다. 그 아래 COMING SOON 셋은 사용자가 정한
// 우선순위(디스코드 연동 → 실시간 리더보드 → 방송 오버레이) 그대로다.
const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: '자동 매치 집계',
    body: '클랜원 카카오 계정을 등록해두면 내전이 끝나는 대로 전적이 자동으로 쌓입니다.',
    ready: true,
  },
  {
    title: '랭킹 시스템',
    body: '킬 점수와 순위 점수를 합친 종합 점수로, 같은 티어끼리만 비교해 순위를 매깁니다.',
    ready: true,
  },
  {
    title: '매치 기록',
    body: '내전 세션별로 각 경기의 팀 순위·킬·생존시간을 한눈에 들여다볼 수 있어요.',
    ready: true,
  },
  {
    title: '내전 팀 구성',
    body: '명단만 올리면 티어 배치, 팀 구성, 실시간 스코어시트까지 한 화면에서 끝납니다.',
    ready: true,
  },
  {
    title: '클랜원 페이지',
    body: '클랜원 개인별 전적과 6각형 지표를 보여주는 프로필 페이지예요.',
    ready: false,
    badgeLabel: '제작중',
  },
  {
    title: '디스코드 연동',
    body: '내전 결과와 랭킹 변동을 디스코드 채널로 바로 전달합니다.',
    ready: false,
  },
  {
    title: '실시간 리더보드',
    body: '내전이 진행되는 동안 점수가 실시간으로 갱신되는 리더보드를 제공합니다.',
    ready: false,
  },
  {
    title: '방송 오버레이',
    body: 'OBS 브라우저 소스로 리더보드를 방송 화면에 그대로 띄울 수 있습니다.',
    ready: false,
  },
];

export const siteConfig = {
  siteName: 'RAGE AGIT',

  // 로고 교체 지점. public/ 아래에 파일을 넣고 src 만 채우면 된다.
  // src 가 '' 이면 기본 다이아몬드 마크로 폴백한다.
  logo: {
    src: '',
    alt: 'RAGE AGIT 로고',
    width: 120,
    height: 28,
  },

  nav: [
    { label: '소개', href: '/about', ready: true },
    { label: '리더보드', href: '/dashboard', ready: true },
    { label: '내전', href: '/team-builder', ready: true },
    { label: '클랜원', href: '/members', ready: true },
    { label: '매치 기록', href: '/matches', ready: true },
  ],

  hero: {
    eyebrow: 'VICTORY ANALYTICS',
    statusLabel: 'LIVE · CLAN SCRIM',
    headline: {
      lead: '내 ',
      highlightWhite: '우승',
      highlightAccent: '확률',
      highlightComma: ',',
      tailHighlight: '직접',
      tailRest: ' 확인하자.',
    },
    // 문장 두 개를 줄바꿈 없이 한 줄씩 보여주고 싶어서 나눠뒀다 — 이어붙여
    // 한 문단으로 두면 화면 폭에 따라 아무 데서나(단어 중간에도) 줄바꿈된다.
    bodyLines: [
      '가입? 등록? 그런 거 없어요 — 총무가 이미 다 긁어놨습니다.',
      '최근 10경기 동안 얼마나 잘했는지, 킬·데미지·순위·생존율로 쪼개서 확인합니다.',
    ],
    ctaLabel: '리더보드 보기',
    ctaHref: '/dashboard',
  },

  // 매주 갱신. weeklyDelta 는 이번 주 순증가분.
  members: {
    total: 469,
    weeklyDelta: 12,
  },

  footer: {
    // 마지막 문장만 포인트 컬러로 강조한다.
    description: '매주 목·일 열리는 클랜 내전 기록을 자동으로 모아 클랜원별 지표로 보여주는 대시보드.',
    descriptionAccent: '감이 아니라 기록입니다.',
    credit: 'Data based on KAKAO PUBG Open API',
    links: [
      { label: '리더보드', href: '/dashboard', ready: true },
      { label: '클랜원', href: '/members', ready: true },
      { label: '내전', href: '/team-builder', ready: true },
      { label: '매치 기록', href: '/matches', ready: true },
      { label: '랭킹', href: '/rankings', ready: false },
    ],
    tagline: '배틀그라운드 클랜 RAGE의 내전 기록 보관소.',
  },

  dashboard: {
    pageHeading: '리더보드',
    tierRanking: {
      eyebrow: 'LEADERBOARD',
      heading: '리더보드',
    },
    recentScrims: {
      eyebrow: 'RECENT SCRIMS',
      heading: '최근 내전',
      participantSuffix: '명 참여',
      matchSuffix: '경기',
      replayLabel: '다시보기',
      replayPendingLabel: '다시보기 준비중',
    },
  },

  matches: {
    pageHeading: '내전 기록',
  },

  memberDirectory: {
    pageHeading: '클랜원',
    eyebrow: 'CLAN ROSTER',
    heading: '클랜원 목록',
    searchPlaceholder: '닉네임 검색',
    insufficientDataMessage: '아직 내전 기록이 없습니다.',
  },

  features: {
    eyebrow: 'PLATFORM FEATURES',
    heading: '클랜 운영에 필요한 모든 것',
    items: FEATURE_ITEMS,
  },

  about: {
    eyebrow: 'ABOUT',
    headline: {
      emphasis: '"내가 쟤보단 잘하지 않나?"',
      plainLead: '이제 ',
      plainHighlight: '숫자',
      plainTail: '로 나옵니다',
    },
    body: '클랜원 469명, 내전 100번 넘게 쌓인 기록을 모아서 등수·킬·활동량을 점수 하나로 정리했어요. 감이 아니라 기록으로 확인하는 거예요.',

    why: {
      eyebrow: '01 · WHY',
      heading: '왜 이걸 만들었냐면.',
      intro:
        '내전이 끝나면 등수도 킬도 각자 흩어져서 클랜톡에 툭툭 던져지고 말아요. 누가 진짜 잘했는지는 아무도 정리해주지 않습니다.',
      calloutLabel: 'THE REAL QUESTION',
      calloutHeading: '근데 진짜 궁금한 건 그거잖아요.',
      calloutPoints: [
        '등수만 보면 운 좋은 한 판일 수도 있지 않나요?',
        '킬만 보면 죽어도 킬만 챙기는 사람이 유리하지 않나요?',
        '애초에 티어가 다른 사람끼리 비교하는 게 맞나요?',
      ],
      calloutFooter:
        '등수든 킬이든 하나만 보면 반쪽짜리예요. 그리고 티어가 다른데 그냥 비교하면 애초에 공정하지도 않고요.',
      closing: '그래서 만들었습니다. 매치당 등수+킬을 합친 성적을, 같은 티어 사람들끼리만 비교해서 점수로 보여주는 거예요.',
      closingAccent: '잘한 척, 못한 척 안 통하게.',
    },

    how: {
      eyebrow: '02 · HOW',
      heading: '어떻게 굴러가냐면.',
      intro:
        '클랜원이 할 일은 없어요. 총무가 명단만 올려두면 그다음부터는 전부 자동입니다. 계산 방식은 복잡해서 다 안 적을게요 — 큰 흐름만 봐주세요.',
      steps: [
        {
          title: '명단 등록',
          body: '총무가 디스코드 명단을 긁어서 여기 업로드하면 끝. 클랜원은 로그인은커녕 아무것도 안 눌러도 됩니다 — 그래서 비밀번호나 로그인 정보는 애초에 받을 수가 없어요.',
        },
        {
          title: '내전 자동 수집',
          body: '매주 목·일 밤 7시 30분 내전이 끝나면, 서버가 등록된 닉네임의 최근 전적을 PUBG 공식 API로 조회해서 내전만 골라 저장합니다.',
        },
        {
          title: '점수 계산',
          body: '같은 티어 그룹 안에서 상대적으로 얼마나 잘했는지를 통계적으로 점수화합니다. 그룹 평균인 사람은 항상 50점, 잘할수록 100에 가까워집니다.',
        },
        {
          title: '리더보드 공개',
          body: '내전 4경기가 다 끝나면 리더보드가 갱신돼요. 한 경기 하고 순위 오른 척은 못 합니다.',
        },
      ],
    },

    data: {
      eyebrow: '03 · DATA',
      heading: '뭘 가져왔고, 뭘 저장했냐면.',
      intro: '세 군데에서 긁어옵니다. 최근 건 API로 자동, 예전 건 사람이 손으로 옮겼어요.',
      sources: [
        {
          tag: 'LIVE',
          name: 'PUBG Open API (카카오)',
          detail: '매주 자동으로 최근 전적을 가져옵니다 (2026-06-07 이후).',
        },
        {
          tag: 'BACKFILL',
          name: 'dak.gg',
          detail: 'API가 못 가는 예전 기록을 웹에서 긁어왔습니다 (~2026-06-07).',
        },
        {
          tag: 'MANUAL',
          name: '디스코드 결과 스크린샷',
          detail: '그보다 더 예전(2026-02~05) 내전은 디스코드에 올라온 결과 사진을 사람이 직접 옮겼습니다.',
        },
      ],
      endpointsLabel: 'PUBG OPEN API ENDPOINTS WE CALL',
      endpointsIntro: '저희 서버가 부르는 API는 딱 이 두 개입니다. 전부 PUBG가 공개해둔 조회 전용 API예요.',
      endpoints: [
        { path: '/shards/kakao/players', body: '등록한 닉네임으로 계정을 찾습니다.' },
        { path: '/shards/kakao/matches/{id}', body: '그 계정이 뛴 매치의 상세 기록(등수·킬 등)을 가져옵니다.' },
      ],
      storedLabel: 'DB 에 저장된 것',
      stored: [
        '등록한 PUBG 닉네임, 계정 식별자',
        '매치별 등수·킬·데미지·생존시간 등 상세 기록',
        '디스코드 닉네임 (표시용)',
        '티어 (자체 기입)',
      ],
      notStoredLabel: 'DB 에 저장되지 않는 것',
      notStored: [
        '카카오 계정 비밀번호, 이메일, 전화번호 — 애초에 받지도 않습니다',
        '로그인 토큰, OAuth 정보',
        '실명, 결제 정보',
      ],
      closing: '등록은 PUBG 닉네임 하나 알려주는 것뿐이에요. 계정 접근 권한이나 개인정보는 어디에도 필요 없습니다.',
    },
  },
} as const;
