import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0E0B13',
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
