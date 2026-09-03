import { tierNameplateStyle } from '@/lib/memberStats';

// 티어를 맨 글자가 아니라 둥근 배지로 보여준다 — team-builder 네임플레이트와
// 같은 배색 함수(tierNameplateStyle)를 그대로 가져다 쓴다(새 색을 만들지
// 않는다, lib/memberStats.ts 가 티어 색의 유일한 출처).
//
// 리더보드와 클랜원 상세가 같은 것을 보여주므로 정의도 하나여야 한다. 예전에는
// 리더보드 안에만 있어서 상세 화면은 '3.5티어' 라고 맨 글자로 적었고, 같은
// 사람이 화면을 옮길 때마다 티어가 다른 물건처럼 보였다.
export function TierBadge({
  tier,
  className = '',
  size = 'sm',
}: {
  tier: number;
  className?: string;
  /** 상세 화면처럼 큰 제목 밑에 놓을 때는 'md'. 표 안에서는 'sm'. */
  size?: 'sm' | 'md';
}) {
  const style = tierNameplateStyle(tier);
  const scale = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border font-bold ${scale} ${className}`}
      style={{
        background: style.background,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color,
      }}
    >
      {tier}티어
    </span>
  );
}
