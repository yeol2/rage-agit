import { Bone, HeadingBones, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 내전 기록 로딩 뼈대 — 실제와 같은 자리: 제목 → 날짜 줄(16px, mb-3) → 가운데
// 시트(1134×721, 16팀) → mt-10 내전 목록(줄당 104px).
export default function MatchesLoading() {
  return (
    <PageSkeleton>
      <HeadingBones />
      <div className="mt-10">
        <Bone className="mx-auto mb-3 h-4 w-36" />
        <Bone className="mx-auto h-[721px] w-full max-w-[1134px]" />
      </div>
      <div className="mt-10 space-y-px">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-[104px] rounded-none" />
        ))}
      </div>
    </PageSkeleton>
  );
}
