import { Bone, HeadingBones, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 명예의 전당 로딩 뼈대 — 제목 → 설명 한 줄 → 가운데 카드 한 장(양옆은 작고 흐린
// 카드가 반쯤) + 넓은 화면은 양옆 ‹ › 버튼. 실제 화면(RecordCarousel)과 같은 모양이다.
function CardBones() {
  return (
    <>
      <Bone className="h-6 w-28" />
      <Bone className="mt-1 h-4 w-56" />
      <div className="mt-4 space-y-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <Bone key={i} className="h-[58px] rounded-xl" />
        ))}
      </div>
    </>
  );
}

export default function HallOfFameLoading() {
  return (
    <PageSkeleton>
      <HeadingBones />
      {/* 읽는 법 박스(번호 네 줄) */}
      <Bone className="mt-5 h-[130px] w-full max-w-xl rounded-2xl" />
      <div className="mt-10 flex items-start gap-4">
        <Bone className="mt-40 hidden h-12 w-12 shrink-0 rounded-full sm:block" />
        <div className="relative flex min-w-0 flex-1 justify-center overflow-hidden">
          {/* 양옆 카드 — 작고 흐리게, 절반 아래로만 보인다 */}
          <div className="absolute left-0 top-0 hidden w-[21%] scale-[0.86] opacity-40 blur-[3px] sm:block">
            <CardBones />
          </div>
          <div className="w-[86%] rounded-2xl border border-white/[0.06] p-4 sm:w-[64%] sm:p-5 lg:w-[53%]">
            <CardBones />
          </div>
          <div className="absolute right-0 top-0 hidden w-[21%] scale-[0.86] opacity-40 blur-[3px] sm:block">
            <CardBones />
          </div>
        </div>
        <Bone className="mt-40 hidden h-12 w-12 shrink-0 rounded-full sm:block" />
      </div>
    </PageSkeleton>
  );
}
