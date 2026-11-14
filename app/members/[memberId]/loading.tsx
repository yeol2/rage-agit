import { Bone, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 클랜원 한 명 로딩 뼈대 — 실제 카드(880px, py-10)의 칸 높이를 그대로 쟀다:
// 이름 40 → 티어 배지 30 → 등수 칩 54 → 점수 링 358 → 6각형 419 → 깐부 161 → 맵 345.
export default function MemberLoading() {
  return (
    <PageSkeleton>
      <div className="mx-auto flex max-w-[880px] flex-col items-center rounded-2xl border border-white/10 px-6 py-10 sm:px-8">
        <Bone className="h-10 w-48" />
        <Bone className="mt-3 h-[30px] w-20 rounded-full" />
        <Bone className="mt-5 h-[54px] w-2/3" />
        <Bone className="mt-8 h-[358px] w-full" />
        <Bone className="mt-8 h-[419px] w-full" />
        <Bone className="mt-8 h-[161px] w-full" />
        <Bone className="mt-8 h-[345px] w-full" />
      </div>
    </PageSkeleton>
  );
}
