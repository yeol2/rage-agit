import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 사이트 전체 바탕색. 시상대 박스 그라데이션의 끝값도 이 색으로 맞춰야
        // 아래로 갈수록 배경에 자연스럽게 잠긴다(TierRankingPodium.tsx 참고).
        background: '#0E0B13',
        // 브랜드 강조색 — 리더보드의 "선택된 토글 탭" 색(역대 전체/최근 12매치,
        // 종합점수/평균등수/평균킬, 티어 탭)이 전부 이 accent 를 쓴다.
        // `bg-accent`, `text-accent` 클래스로 컴포넌트 전역에서 참조되므로,
        // 여기 값을 바꾸면 토글 선택색뿐 아니라 다른 강조 요소도 같이 바뀐다.
        accent: '#FF9233',
        'accent-secondary': '#C49520',
        foreground: '#FFFFFF',
        muted: '#322F36',
        subtext: '#7B797D',
        menu: '#A0A0A2',
        positive: '#4ADE80',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      maxWidth: {
        shell: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
