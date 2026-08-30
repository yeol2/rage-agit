import { revalidatePath } from 'next/cache';

// 내전 기록이 바뀌었을 때 캐시를 버려야 하는 공개 화면들.
//
// 목록을 한 곳에 두는 이유: 값을 쓰는 경로가 둘(03 시트의 폴링 버튼과 우승 확정
// 버튼)이라, 각자 따로 적어두면 한쪽만 고쳐졌을 때 화면마다 다른 시점을 보여준다.
// 실제로 우승 확정은 /members 를 갱신하고 폴링은 안 해서, 같은 내전인데 명단
// 화면만 5분 늦게 따라오는 상태였다.
//
// 리더보드(/dashboard)는 여기 없다 — 일부러 뺐다. 그 화면만은 4라운드가 다
// 기록된 순간에만 바뀌어야 한다(등수 변동 스냅샷을 찍는 시점과 같아야 하므로).
// 자세한 이유는 app/dashboard/page.tsx 의 revalidate = false 주석에 있다.
//
// 팀 구성 화면(/team-builder)도 없다. force-dynamic 이라 애초에 캐시가 없다.
export function revalidateRecordPages(): void {
  revalidatePath('/members');
  // 동적 경로는 경로 패턴 + 'page' 로 지워야 한다. '/members' 만 지우면 목록만
  // 새로 그려지고 클랜원 한 명 한 명의 상세 페이지는 옛 값을 그대로 들고 있다.
  revalidatePath('/members/[memberId]', 'page');
  revalidatePath('/matches');
}
