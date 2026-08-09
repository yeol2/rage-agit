import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // .claude/worktrees/**는 각자 자기 node_modules(별도 React 사본)를 갖고 있어서,
    // 기본 include 패턴이 그 안까지 스캔하면 React가 두 벌 로드되어
    // "recoverFromConcurrentError" 같은 가짜 실패가 난다. 워크트리를 남겨둬도
    // 안전하도록 명시적으로 제외한다.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
