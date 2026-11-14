import { Bone, HeadingBones, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 명예의 전당 로딩 뼈대 — 제목 → 설명 한 줄 → 기록 카드 2열(카드마다 10줄).
// 실제 화면(app/hall-of-fame/page.tsx, RecordCard)과 같은 간격이다.
export default function HallOfFameLoading() {
  return (
    <PageSkeleton>
      <HeadingBones />
      <Bone className="mt-3 h-5 w-full max-w-[520px]" />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, card) => (
          <div key={card} className="rounded-2xl border border-white/[0.06] p-4 sm:p-5">
            <Bone className="h-6 w-28" />
            <Bone className="mt-1 h-4 w-56" />
            <div className="mt-4 space-y-1.5">
              {Array.from({ length: 10 }, (_, i) => (
                <Bone key={i} className="h-[58px] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
