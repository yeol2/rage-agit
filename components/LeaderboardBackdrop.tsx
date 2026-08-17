// 피그마 원본(Leaderboard Community, 1600x1200 프레임)의 배경 레이어를 그대로 옮긴 것.
// 원본 카드 폭 1483.59 를 우리 셸 1200 에 맞추면 축척은 0.809 다.
//
//  Ellipse 1  상단 반구   1483.59 × 581.07, Y −348.17, #161823, 안쪽그림자(Y 4.12 / 흐림 55.63)
//  Ellipse 7  가로 발광   1017.01 × 112.3,  Y 25.85,   #0042B8, 레이어 흐림
//  Ellipse 8  수직 광선   403.87 × 139.09,  90° 회전,  #0074F1, 레이어 흐림
//  Group 4    별 입자     1521.95 × 1165.19, #8AC8FF
//
// 색만 우리 팔레트(#0E0B13 배경 / #FF9233 강조)로 바꾸고 형태·비율은 원본을 따른다.

// 별 입자 — 원본 Group 4. 좌표를 고정값으로 박아 서버/클라이언트 렌더가 어긋나지 않게 한다.
const STARS: Array<{ left: string; top: string; size: number; opacity: number }> = [
  { left: '6%', top: '14%', size: 2, opacity: 0.35 },
  { left: '13%', top: '38%', size: 1, opacity: 0.25 },
  { left: '19%', top: '9%', size: 1, opacity: 0.3 },
  { left: '24%', top: '52%', size: 2, opacity: 0.2 },
  { left: '31%', top: '21%', size: 1, opacity: 0.3 },
  { left: '38%', top: '44%', size: 1, opacity: 0.22 },
  { left: '44%', top: '11%', size: 2, opacity: 0.32 },
  { left: '52%', top: '30%', size: 1, opacity: 0.26 },
  { left: '58%', top: '7%', size: 1, opacity: 0.3 },
  { left: '64%', top: '48%', size: 2, opacity: 0.24 },
  { left: '71%', top: '17%', size: 1, opacity: 0.3 },
  { left: '77%', top: '41%', size: 1, opacity: 0.22 },
  { left: '83%', top: '12%', size: 2, opacity: 0.34 },
  { left: '89%', top: '33%', size: 1, opacity: 0.26 },
  { left: '94%', top: '20%', size: 1, opacity: 0.3 },
];

export function LeaderboardBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
      {/* Group 4 — 별 입자 */}
      <div className="absolute inset-0">
        {STARS.map((star) => (
          <span
            key={`${star.left}-${star.top}`}
            className="absolute rounded-full bg-[#FFD9B8]"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/*
        Ellipse 1 — 상단 반구.
        원본은 카드 폭(1483.59)이 곧 화면 전체라 반구가 꽉 찬다. 우리는 전체화면
        레이아웃이므로 폭을 뷰포트에 걸어야 같은 그림이 된다 — 원본 비율
        (H/W = 581.07/1483.59 = 0.392, 보이는 높이 = W × 0.157)만 그대로 지킨다.

        원본의 안쪽 그림자는 Y가 +4.12 라 '위쪽' 안쪽 테두리에만 생기는데,
        그 부분은 화면 밖으로 잘려 나간다. 그래서 아래 호가 눈에 보이도록
        테두리(획)로 아치 선을 직접 그린다.
      */}
      <div
        className="absolute left-1/2 top-0 rounded-[50%] border-t-0"
        style={{
          width: '130vw',
          height: '50.9vw',
          transform: 'translateX(-50%) translateY(-30.5vw)',
          background: '#1B1524',
          border: '1px solid rgba(255, 146, 51, 0.16)',
        }}
      />

      {/* Ellipse 7 — 네비바 뒤 가로 발광 */}
      <div
        className="absolute left-1/2 top-[21px] h-[91px] w-[823px] -translate-x-1/2 rounded-[50%] blur-[70px]"
        style={{ background: 'rgba(255, 146, 51, 0.22)' }}
      />

      {/* Ellipse 8 — 1위 머리 위로 떨어지는 수직 광선 */}
      <div
        className="absolute left-1/2 top-0 h-[327px] w-[112px] -translate-x-1/2 -translate-y-[106px] rounded-[50%] blur-[60px]"
        style={{ background: 'rgba(255, 146, 51, 0.28)' }}
      />
    </div>
  );
}
