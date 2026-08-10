import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// 팩토리 안에 데이터를 두는 이유: vi.mock 은 파일 맨 위로 끌어올려지므로
// 바깥에 선언한 변수를 참조하면 초기화 전에 접근하게 된다.
vi.mock('@/lib/memberStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/memberStats')>()),
  fetchAllMembers: vi.fn().mockResolvedValue([
    { id: 'm-1', discordNickname: 'Ez_Alpha', tier: 0 },
  ]),
}));

// eslint-disable-next-line import/first
import MembersPage from './page';

afterEach(cleanup);

describe('MembersPage', () => {
  it('제목을 그리고 암구호로 가려둔다', async () => {
    render(await MembersPage());
    // 잠긴 동안은 AccessGate 가 자식에 aria-hidden 을 걸어 스크린리더가 못 쓰는
    // 콘텐츠를 안내하지 않게 한다 — 그래서 접근성 role 이 아니라 텍스트로 찾는다.
    expect(screen.getByText('클랜원 목록')).toBeInTheDocument();
    // 이 테스트 프로세스에는 암구호가 설정돼 있지 않으므로 게이트가 잠긴 채다.
    expect(screen.getByText('Rage 클랜원을 인증하세요')).toBeInTheDocument();
  });
});
