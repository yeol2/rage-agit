import { MapBadge } from '@/components/MapBadge';
import { WinBadge } from '@/components/WinBadge';
import type { MapBadge as MapBadgeData } from '@/lib/mapStats';

// 클랜원 상세 화면 이름 아래의 뱃지 줄.
//
// 리더보드 뱃지 칸과 **같은 뱃지를 같은 순서로** 놓는다(우승 → 맵). 한 사람을
// 두 화면에서 볼 때 뱃지가 다른 모양이나 다른 순서로 나오면, 둘이 같은 것인지
// 확인하러 눈이 왔다 갔다 한다.
//
// 옆 글자는 '내전우승'뿐이다. 횟수는 뱃지의 숫자가 말하므로 "내전우승 4회"라고
// 또 적으면 같은 값을 두 번 쓰는 셈이다.
export function WinTrophies({ count, mapBadges = [] }: { count: number; mapBadges?: MapBadgeData[] }) {
  // 아무 뱃지도 없으면 줄을 통째로 뺀다 — 빈 자리를 "0회"로 채우면 이름 아래에
  // 의미 없는 줄만 하나 늘어난다.
  if (count <= 0 && mapBadges.length === 0) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-menu">
      {count > 0 && (
        <span className="flex items-center gap-1.5">
          {/* 칸이 넉넉한 화면이라 광택을 켠다. 표처럼 수십 개가 깔리는 곳에서는
              동시에 번쩍여서 눈에 거슬리므로 거기서는 꺼둔다. */}
          <WinBadge count={count} className="text-[15px]" sheen chipColor="#231F2B" />
          <span>내전우승</span>
        </span>
      )}
      {mapBadges.map((badge) => (
        <MapBadge key={`${badge.mapName}-${badge.kind}`} badge={badge} className="text-[15px]" />
      ))}
    </div>
  );
}
