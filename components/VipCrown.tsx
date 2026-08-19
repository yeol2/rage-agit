// VIP 표식 — 네임플레이트 오른쪽 위 모서리에 걸치는 왕관.
//
// 원본은 Figma "VIP会员质感图标" 의 3D 왕관으로, 벡터·그라데이션·블러 필터가 30겹
// 넘게 쌓여 있다. 인라인 SVG로 박으면 VIP 한 명당 20KB짜리 DOM이 복제되므로
// public/vip-crown.svg 정적 파일로 두고 <img> 로 참조한다 — 브라우저가 한 번만
// 받아서 캐시하고, 필터 합성도 이미지 레이어에서 한 번만 일어난다.
//
// 원본 viewBox 는 606x552(가로가 조금 더 김)라 높이는 자동으로 따라간다.
export function VipCrown({ className = '' }: { className?: string }) {
  return (
    <img
      src="/vip-crown.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`pointer-events-none absolute -right-1.5 -top-2 w-4 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${className}`}
    />
  );
}
