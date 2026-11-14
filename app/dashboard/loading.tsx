import { Bone, PageSkeleton } from '@/components/skeleton/PageSkeleton';

// 리더보드 로딩 뼈대. 간격·크기는 TierRankingPodium 의 실제 클래스를 그대로
// 옮겼다 — 로딩이 끝나 진짜 화면으로 바뀔 때 박스가 제자리에서 내용으로만
// 바뀌어야지, 위치가 튀면 오히려 어색하다(2026-11-14 사용자 지적). 그쪽 레이아웃을
// 바꾸면 여기도 같이 맞출 것.

// 실제와 같은 순서: 2위 · 1위 · 3위, 양옆은 mt-9 만큼 낮다.
const PODIUM_OFFSETS = ['mt-9', 'mt-0', 'mt-9'] as const;

export default function DashboardLoading() {
  return (
    <PageSkeleton>
      {/* 제목 — 가운데 정렬 */}
      <div className="flex flex-col items-center">
        <Bone className="h-4 w-28" />
        <Bone className="mt-6 h-9 w-32 md:h-10" />
      </div>

      {/* 역대 전체 / 최근 내전 4회 토글 */}
      <div className="mt-8 flex justify-center">
        <Bone className="h-11 w-[236px] rounded-xl" />
      </div>

      {/* 종합점수 · 평균등수 · 평균킬 */}
      <div className="mt-8 flex justify-center gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Bone key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>

      {/* 티어 그룹 */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Bone className="h-9 w-14 rounded-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-9 w-[92px] rounded-full" />
        ))}
      </div>

      {/* 시상대 */}
      <div className="mx-auto mt-12 flex max-w-4xl items-start justify-center gap-2 sm:gap-[3%]">
        {PODIUM_OFFSETS.map((offset, i) => (
          <div key={i} className={`${offset} flex min-w-0 flex-1 basis-0 flex-col items-center`}>
            <Bone className="h-16 w-16 rounded-xl sm:h-20 sm:w-20" />
            <Bone className="mt-3 h-7 w-28 sm:h-8" />
            {/* 실제는 이름 아래 ▼(mt-1, 10px) 다음 mt-8 — 합쳐서 46px */}
            <div className="mt-[46px] w-full">
              {/* 윗면 사다리꼴 + 앞면 — 실제 시상대와 같은 모양 */}
              <Bone
                className="h-8 w-full rounded-none sm:h-10"
                style={{ clipPath: 'polygon(0% 100%, 100% 100%, 84% 0%, 16% 0%)' }}
              />
              <Bone className="-mt-px h-[190px] w-full rounded-none sm:h-[220px]" />
            </div>
          </div>
        ))}
      </div>

      {/* 다음 내전까지 */}
      <div className="mx-auto mt-10 flex w-fit flex-col items-center gap-3">
        <Bone className="h-7 w-7 rounded-full" />
        <Bone className="h-4 w-24" />
        <Bone className="h-7 w-44 sm:h-8" />
      </div>

      <div aria-hidden="true" className="mx-auto mt-12 h-px w-[43%] bg-white/10" />

      {/* 4위 이하 표 */}
      <div className="mx-auto mt-8 max-w-4xl">
        <Bone className="h-6 w-full" />
        <div className="mt-1 space-y-1">
          {Array.from({ length: 8 }, (_, i) => (
            <Bone key={i} className="h-11 w-full" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
