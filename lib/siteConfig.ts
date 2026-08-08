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
    { label: 'DASHBOARD', href: '/dashboard', ready: true },
    { label: 'MEMBERS', href: '/members', ready: false },
    { label: 'MATCHES', href: '/matches', ready: false },
    { label: 'RANKINGS', href: '/rankings', ready: false },
  ],

  hero: {
    eyebrow: 'VICTORY ANALYTICS',
    statusLabel: 'LIVE · CLAN SCRIM',
    headlineMuted: '내 우승확률,',
    headlineWhite: '직접',
    headlineAccent: '확인하자.',
    body: '카카오 계정 하나만 등록하면 클랜 내전 전적을 바로 볼 수 있어요. 최근 10경기 동안 얼마나 잘했는지, 킬·데미지·순위·생존율로 쪼개서 확인합니다.',
    ctaLabel: '대시보드 보기',
    ctaHref: '/dashboard',
  },

  // 매주 갱신. weeklyDelta 는 이번 주 순증가분.
  members: {
    total: 469,
    weeklyDelta: 12,
  },

  footer: {
    // 마지막 문장만 포인트 컬러로 강조한다.
    description: '매주 일요일 클랜 내전 기록을 자동으로 모아 클랜원별 지표로 보여주는 대시보드.',
    descriptionAccent: '감이 아니라 기록입니다.',
    credit: 'Data based on KAKAO PUBG Open API',
    links: [
      { label: '대시보드', href: '/dashboard', ready: true },
      { label: '클랜원', href: '/members', ready: false },
      { label: '매치 기록', href: '/matches', ready: false },
      { label: '랭킹', href: '/rankings', ready: false },
    ],
    tagline: '배틀그라운드 클랜 RAGE의 내전 기록 보관소.',
  },

  dashboard: {
    pageHeading: '대시보드',
    tierRanking: {
      eyebrow: 'TIER RANKING',
      heading: '티어 랭킹',
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

  features: {
    eyebrow: 'PLATFORM FEATURES',
    heading: '클랜 운영에 필요한 모든 것',
    items: [
      {
        title: '자동 매치 집계',
        body: '클랜원 카카오 계정을 등록해두면 일요일 내전이 끝나는 대로 전적이 자동으로 쌓입니다.',
        ready: true,
      },
      {
        title: '클랜원 대시보드',
        body: '최근 10경기 기준 평균 킬·데미지·어시스트, 평균 순위, 생존율을 한 화면에서 확인하세요.',
        ready: true,
      },
      {
        title: '랭킹 시스템',
        body: '킬 점수와 순위 점수를 합산한 종합 점수로 클랜원 순위를 자동 집계합니다.',
        ready: true,
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
      {
        title: '디스코드 연동',
        body: '내전 결과와 랭킹 변동을 디스코드 채널로 바로 전달합니다.',
        ready: false,
      },
    ],
  },
} as const;
