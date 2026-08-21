// 이모지 🔑는 OS/브라우저마다 다르게 그려져서 색을 못 입히고 형태도 흐릿하다 —
// currentColor를 따르는 SVG로 바꿔서 항상 또렷한 열쇠 모양이 나오게 한다.
export function KeyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
    </svg>
  );
}
