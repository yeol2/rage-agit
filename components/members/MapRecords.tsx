import { killsDelta, rankDelta, type MapStat } from '@/lib/mapStats';
import { SCRIM_LABEL } from '@/lib/scrimCounting';

// 맵별 기록 — 내전 네 라운드를 라운드 순서대로 늘어놓는다.
//
// 기준선은 **그 사람의 전체 평균** 하나다. 네 줄이 같은 선을 공유하므로 편차의
// 합이 0이 되고, 위로 뻗은 만큼 아래로 뻗은 맵이 있다 — 그래서 "강한 맵과 약한
// 맵"으로 바로 읽힌다. 줄마다 "그 맵을 뺀 나머지 평균"을 기준으로 삼으면 네 줄이
// 서로 다른 기준을 쓰면서 화면에는 같은 선 하나로 그려진다.
//
// 자격선은 없다. 뛴 맵은 전부 보여주고 경기 수를 같이 적는다 — 몇 경기짜리
// 평균이냐에 따라 같은 ▲2.0 이 뜻하는 바가 완전히 다른데(4경기면 오차가 ±2.35등,
// 14경기면 ±1.3등), 그 사실은 숨기는 것보다 경기 수를 옆에 적어 읽는 사람이
// 감안하게 하는 편이 낫다.

const GOOD_COLOR = '#7FE0A8';
const BAD_COLOR = '#FF8A8A';

// 막대 한쪽 끝이 몇 등인가. 실측 최대가 ±7등이지만 거기에 맞추면 대부분의 막대가
// 안 보일 만큼 짧아져서, 흔한 범위인 4등에 맞추고 넘으면 끝에 붙인다.
const BAR_RANGE = 4;

function MapRow({ stat }: { stat: MapStat }) {
  const delta = rankDelta(stat);
  const better = delta > 0;
  const width = Math.min(50, (Math.abs(delta) / BAR_RANGE) * 50);

  return (
    <li
      className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3"
      data-testid={`map-row-${stat.mapName}`}
    >
      <span className="text-[13px] font-bold text-foreground">{stat.label}</span>

      <span className="relative block h-1.5 rounded-full bg-white/[0.07]">
        <span aria-hidden="true" className="absolute inset-y-[-3px] left-1/2 w-px bg-white/40" />
        <span
          className="absolute inset-y-0 block rounded-full"
          style={{
            width: `${width}%`,
            [better ? 'left' : 'right']: '50%',
            background: better ? GOOD_COLOR : BAD_COLOR,
          }}
        />
      </span>

      <span className="text-right text-[11px] leading-tight tabular-nums text-menu">
        <b className="font-bold text-foreground">{stat.avgRank.toFixed(1)}등</b>
        <span className="ml-1" style={{ color: better ? GOOD_COLOR : BAD_COLOR }}>
          {better ? '▲' : '▼'}
          {Math.abs(delta).toFixed(1)}
        </span>
        <br />
        <span className="text-subtext">
          {stat.games}경기 · {stat.avgKills.toFixed(2)}킬
          {killsDelta(stat) >= 0 ? ' ▲' : ' ▼'}
          {Math.abs(killsDelta(stat)).toFixed(2)}
        </span>
      </span>
    </li>
  );
}

export function MapRecords({ stats }: { stats: MapStat[] }) {
  const overall = stats[0];

  return (
    <div data-testid="map-records">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="hud text-sm font-bold text-foreground">맵별 기록</p>
        {overall && (
          <span className="text-[11px] tabular-nums text-subtext">
            {SCRIM_LABEL.allTime} {overall.totalGames}경기 · 평균{' '}
            {overall.overallAvgRank.toFixed(1)}등 · {overall.overallAvgKills.toFixed(2)}킬
          </span>
        )}
      </div>

      {stats.length === 0 ? (
        <p className="mt-3.5 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 py-8 text-center text-sm text-menu">
          아직 맵별로 나눠 볼 기록이 없습니다.
        </p>
      ) : (
        <ul className="mt-3.5 space-y-3 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 pb-4 pt-2.5">
          {/* 가운데선이 무엇인지는 선 바로 위에 적는다. 칸 밖에 문장으로 적어두면
              읽는 사람이 그 문장과 선을 눈으로 이어붙여야 한다. */}
          <li aria-hidden="true" className="grid grid-cols-[3.25rem_1fr_auto] items-end gap-3">
            <span />
            <span className="relative block h-3">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] leading-none text-menu">
                내 평균
              </span>
            </span>
            <span className="text-right text-[10px] leading-none text-subtext">맵 평균 · 킬</span>
          </li>

          {stats.map((stat) => (
            <MapRow key={stat.mapName} stat={stat} />
          ))}
        </ul>
      )}
    </div>
  );
}
