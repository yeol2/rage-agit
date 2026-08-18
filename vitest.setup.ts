import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Nav 가 usePathname() 으로 현재 메뉴를 강조 표시하는데, 앱 라우터 컨텍스트 없이
// render() 하는 테스트에서는 next/navigation 훅이 invariant 에러를 던진다.
// 테스트에서 특정 경로를 확인해야 하면 이 목을 파일별로 다시 vi.mock 하면 된다.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));
