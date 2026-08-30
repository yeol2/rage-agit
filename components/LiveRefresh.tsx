'use client';

import { useRouter } from 'next/navigation';
import { useScrimLive } from '@/lib/useScrimLive';

/**
 * 내전 신호를 받으면 이 페이지를 서버에서 다시 받아온다.
 *
 * 대시보드는 revalidate = false 라 시간이 지나도 저절로 안 바뀐다. 값을 바꾼
 * 요청(폴링·우승 확정 라우트)이 revalidatePath 로 캐시를 무효화하지만, 그건
 * "다음에 누가 물어보면 새로 그려라"까지다 — 화면을 켜둔 사람에게 먼저 말을
 * 걸 수단이 없어서, 그 사람은 새로고침할 때까지 옛 화면을 본다. 그 마지막 한
 * 칸을 여기서 메운다.
 *
 * 신호는 DB 트리거가 INSERT 시점에 보내고 revalidatePath 는 그 직후에 도는데,
 * 둘 사이가 겹칠 수 있다. 신호가 먼저 도착해 캐시가 아직 안 지워졌으면 옛
 * 화면을 그대로 다시 받아오고, 그 뒤엔 알려줄 사람이 없다. 브라우저까지의
 * 왕복만 해도 보통 revalidatePath 가 먼저 끝나지만, 확실히 하려고 잠깐 뒤에
 * 새로고침한다.
 */
const REFRESH_DELAY_MS = 1500;

export function LiveRefresh() {
  const router = useRouter();

  useScrimLive(() => {
    setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
  });

  return null;
}
