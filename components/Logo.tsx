export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M16 2 L30 16 L16 30 L2 16 Z" stroke="#FF9233" strokeWidth="1.6" />
      <path d="M16 9 L23 16 L16 23 L9 16 Z" fill="#FF9233" />
    </svg>
  );
}
