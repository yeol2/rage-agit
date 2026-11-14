import { Bone, HeadingBones, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 클랜원 로딩 뼈대 — 실제 화면(MemberDirectory)과 같은 자리: 제목 → 검색창(320×38)
// → 티어별 묶음(라벨 16px, mt-3 격자, 카드 32px, 묶음 사이 32px).
const GROUP_SIZES = [8, 10, 12, 18, 12];

export default function MembersLoading() {
  return (
    <PageSkeleton>
      <HeadingBones />
      <div className="mt-10">
        <Bone className="h-[38px] w-full max-w-[320px]" />
        <div className="mt-8 space-y-8">
          {GROUP_SIZES.map((count, group) => (
            <div key={group}>
              <Bone className="h-4 w-14" />
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: count }, (_, i) => (
                  <Bone key={i} className="h-8" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
