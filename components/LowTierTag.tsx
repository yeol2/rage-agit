/**
 * "저티어 내전" 표시. 저티어 내전으로 확정된 내전이 나오는 모든 자리(매치 기록의
 * 내전 목록, 클랜원 화면의 종합등수 칩, 03 내전 시트)에 같은 모양으로 붙인다.
 * 색은 03 시트의 저티어 토글이 켜졌을 때와 같은 강조색이다.
 */
export function LowTierTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border border-accent/50 bg-accent/10 px-1.5 py-px text-[10px] font-bold leading-[14px] text-accent ${className}`}
    >
      저티어 내전
    </span>
  );
}
