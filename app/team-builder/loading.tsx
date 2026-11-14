import { Bone, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 내전(팀 구성) 로딩 뼈대 — 실제 화면(RosterBoard)과 같은 자리: 라벨 → mt-10
// 단계 제목(40) → mt-10 업로드·조작 줄(38) → mt-6 안내 줄(32, 오른쪽 버튼) →
// mt-6 4열 보드(칸 높이 617).
export default function TeamBuilderLoading() {
  return (
    <PageSkeleton>
      <div className="flex items-center gap-4">
        <Bone className="h-4 w-24" />
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <div className="mt-10">
        <Bone className="h-9 w-56 md:h-10" />
        <Bone className="mt-10 h-[38px] w-full max-w-[520px]" />
        <div className="mt-6 flex h-8 items-center justify-between">
          <Bone className="h-4 w-64" />
          <Bone className="h-8 w-[72px]" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="h-[617px] rounded-lg" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
