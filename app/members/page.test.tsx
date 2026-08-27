import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// 팩토리 안에 데이터를 두는 이유: vi.mock 은 파일 맨 위로 끌어올려지므로
// 바깥에 선언한 변수를 참조하면 초기화 전에 접근하게 된다.
vi.mock('@/lib/memberStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/memberStats')>()),
  // vipRank 를 빼면 undefined 가 되는데, MemberDirectory 는 `!== null` 로 VIP 를
  // 가려내므로 VIP 섹션과 티어 섹션 양쪽에 그려진다. 실제 타입대로 null 을 준다.
  fetchAllMembers: vi.fn().mockResolvedValue([
    { id: 'm-1', discordNickname: 'Ez_Alpha', tier: 0, vipRank: null },
  ]),
}));

// eslint-disable-next-line import/first
import MembersPage from './page';

afterEach(cleanup);

describe('MembersPage', () => {
  it('제목과 명단을 바로 보여준다', async () => {
    render(await MembersPage());
    // 예전에는 암구호 게이트(AccessGate)로 가려뒀지만 이제 누구나 볼 수 있다.
    expect(screen.getByRole('heading', { name: '클랜원 목록' })).toBeInTheDocument();
    expect(screen.getByText('Ez_Alpha')).toBeInTheDocument();
  });
});
