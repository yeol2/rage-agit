import { MIN_GAMES_PER_MAP, type MapBadge, type MapStat } from '@/lib/mapStats';

// 맵별 기록 — 내전 네 라운드를 라운드 순서대로 늘어놓는다.
//
// 비교 대상은 클랜 전체가 아니라 **그 사람의 다른 맵**이다. 클랜 전체와 비교하면
// 상위 티어가 네 맵 모두에서 위에 있어서 "이 맵에서만 유독"이라는 말이 사라진다.
// 다른 맵 대비로 보면 평소 8등인 사람이 에란겔에서만 5등을 하는 것이 그대로
// 드러난다.

const GOOD_COLOR = '#7FE0A8';
const BAD_COLOR = '#FF8A8A';

// 막대 한 칸이 몇 등인가. 최대 ±4등까지 그리고 그보다 크면 끝에 붙인다 —
// 실측 최대가 ±7등이라 거기에 맞추면 대부분의 막대가 안 보일 만큼 짧아진다.
const BAR_RANGE = 4;

function barWidth(delta: number): number {
  return Math.min(100, (Math.abs(delta) / BAR_RANGE) * 100);
}

function MapRow({ stat, badge }: { stat: MapStat; badge: MapBadge | undefined }) {
  const enough = stat.games >= MIN_GAMES_PER_MAP && stat.rankDelta !== null;
  const delta = stat.rankDelta ?? 0;
  const better = delta > 0;

  return (
    <li className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3" data-testid={`map-row-${stat.mapName}`}>
      <span className="flex items-center gap-1 text-[13px] font-bold text-foreground">
        {stat.label}
        {badge && (
          <span aria-hidden="true" title={badge.kind === 'god' ? '이 맵의 신' : '이 맵의 똥'}>
            {badge.kind === 'god' ? '😇' : '💩'}
          </span>
        )}
      </span>

      {/* 가운데선이 '내 다른 맵 평균'이다. 오른쪽으로 뻗으면 이 맵을 더 잘한 것. */}
      <span className="relative block h-1.5 rounded-full bg-white/[0.07]">
        <span aria-hidden="true" className="absolute inset-y-[-3px] left-1/2 w-px bg-white/40" />
        {enough && (
          <span
            className="absolute inset-y-0 block rounded-full"
            style={{
              width: `${barWidth(delta) / 2}%`,
              [better ? 'left' : 'right']: '50%',
              background: better ? GOOD_COLOR : BAD_COLOR,
            }}
          />
        )}
      </span>

      <span className="text-right text-[11px] leading-tight tabular-nums text-menu">
        {enough ? (
          <>
            <b className="font-bold text-foreground">{stat.avgRank.toFixed(1)}등</b>
            <span className="ml-1" style={{ color: better ? GOOD_COLOR : BAD_COLOR }}>
              {better ? '▲' : '▼'}
              {Math.abs(delta).toFixed(1)}
            </span>
            <br />
            <span className="text-subtext">
              {stat.games}경기 · 다른 맵 {stat.otherAvgRank?.toFixed(1)}등
            </span>
          </>
        ) : (
          <span className="text-subtext">{stat.games}경기 · 기록 부족</span>
        )}
      </span>
    </li>
  );
}

export interface MapRecordsProps {
  stats: MapStat[];
  /** 이 사람이 가진 맵 뱃지. 맵 이름으로 찾아 붙인다. */
  badges: MapBadge[];
}

export function MapRecords({ stats, badges }: MapRecordsProps) {
  const badgeByMap = new Map(badges.map((badge) => [badge.mapName, badge]));

  return (
    <div data-testid="map-records">
      <p className="hud text-sm font-bold text-foreground">맵별 기록</p>

      {stats.length === 0 ? (
        <p className="mt-3.5 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 py-8 text-center text-sm text-menu">
          아직 맵별로 나눠 볼 기록이 없습니다.
        </p>
      ) : (
        <ul className="mt-3.5 space-y-3 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 pb-4 pt-2.5">
          {/* 가운데선이 무엇인지는 선 바로 위에 적는다. 칸 밖에 "가운데선 =
              내 다른 맵 평균"이라고 적어두면 읽는 사람이 그 문장과 선을 눈으로
              이어붙여야 하는데, 라벨을 선 위에 놓으면 그 일이 사라진다. */}
          <li aria-hidden="true" className="grid grid-cols-[3.5rem_1fr_auto] items-end gap-3">
            <span />
            <span className="relative block h-3">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] leading-none text-menu">
                평균
              </span>
            </span>
            <span className="text-right text-[10px] leading-none text-subtext">내 다른 맵</span>
          </li>

          {stats.map((stat) => (
            <MapRow key={stat.mapName} stat={stat} badge={badgeByMap.get(stat.mapName)} />
          ))}
        </ul>
      )}
    </div>
  );
}
