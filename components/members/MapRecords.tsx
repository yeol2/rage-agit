import { rankDelta, type MapStat } from '@/lib/mapStats';
import { SCRIM_LABEL } from '@/lib/scrimCounting';

// 맵별 기록 — 내전 네 라운드를 라운드 순서대로 늘어놓는다.
//
// 기준선은 **그 사람의 전체 평균** 하나다. 네 줄이 같은 선을 공유하므로 편차의
// 합이 0이 되고, 위로 뻗은 만큼 아래로 뻗은 맵이 있다 — 그래서 "강한 맵과 약한
// 맵"으로 바로 읽힌다. 줄마다 "그 맵을 뺀 나머지 평균"을 기준으로 삼으면 네 줄이
// 서로 다른 기준을 쓰면서 화면에는 같은 선 하나로 그려진다.
//
// 등수만 다룬다. 킬을 같이 놓으면 한 줄이 두 가지 답을 하게 된다 — 등수는
// 아래로 뻗은 맵이 킬은 위로 뻗을 수 있어서(태이고가 그렇다: 10.6등에 0.71킬),
// 그 줄이 강한 맵인지 약한 맵인지를 화면이 스스로 답하지 못한다. 이 패널의
// 질문은 "어느 맵이 강한가" 하나뿐이므로 답도 하나여야 한다. 킬은 위 전적
// 요약이 이미 말한다.
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

// 소수 첫째 자리까지만 쓰므로 이보다 작은 차이는 화면에서 0.0 이다. 0.0 은
// "차이가 있는데 아주 작다"로 읽히지만 실제로는 **차이가 없다**는 뜻이라,
// 방향 화살표까지 달면 없는 우열을 있다고 말하게 된다. 그래서 줄표로 적는다.
const FLAT = 0.05;

function isFlat(delta: number) {
  return Math.abs(delta) < FLAT;
}

/** 편차를 화살표와 함께 적는다. 차이가 없으면 줄표 하나. */
function Delta({ value, className }: { value: number; className: string }) {
  if (isFlat(value)) {
    return (
      <span className={`${className} text-menu`} aria-label="차이 없음">
        –
      </span>
    );
  }
  return (
    <span className={className} style={{ color: value > 0 ? GOOD_COLOR : BAD_COLOR }}>
      {value > 0 ? '▲' : '▼'}
      {Math.abs(value).toFixed(1)}
    </span>
  );
}

function MapRow({ stat }: { stat: MapStat }) {
  const delta = rankDelta(stat);
  const flat = isFlat(delta);
  const better = delta > 0;
  const width = flat ? 0 : Math.min(50, (Math.abs(delta) / BAR_RANGE) * 50);

  return (
    <li
      className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-t border-white/[0.07] py-3.5"
      data-testid={`map-row-${stat.mapName}`}
    >
      {/* 경기 수는 맵 이름 밑에 붙인다. 그 맵을 몇 판 뛰었나는 성적이 아니라
          이 줄을 얼마나 믿을 수 있는지를 말하는 값이라, 오른쪽 성적 칸이 아니라
          맵 이름 쪽에 속한다. */}
      <span className="leading-tight">
        <b className="block text-sm font-bold text-foreground">{stat.label}</b>
        <span className="text-[10px] tabular-nums text-subtext">{stat.games}경기</span>
      </span>

      <span className="relative block h-2 rounded-full bg-white/[0.05]">
        {/* 가운데선은 줄 높이를 넘겨 그린다 — 줄마다 끊기지 않고 패널을 세로로
            관통하는 한 줄이 되어야 "네 맵이 같은 기준을 쓴다"가 눈에 보인다. */}
        <span aria-hidden="true" className="absolute -inset-y-3 left-1/2 w-px bg-white/25" />
        <span
          className="absolute inset-y-0 block rounded-full"
          style={{
            width: `${width}%`,
            [better ? 'left' : 'right']: '50%',
            background: better ? GOOD_COLOR : BAD_COLOR,
          }}
        />
      </span>

      <span className="min-w-[6.5rem] text-right leading-tight tabular-nums">
        <Delta value={delta} className="text-base font-bold" />
        <br />
        <span className="text-[11px] text-subtext">{stat.avgRank.toFixed(1)}등</span>
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
            {overall.overallAvgRank.toFixed(1)}등
          </span>
        )}
      </div>

      {/* 그림만 봐서는 가운데선이 무엇인지, 오른쪽이 좋은 쪽인지 알 수 없다.
          한 줄로 그것만 말한다 — 읽는 법을 설명하지 않으면 막대는 장식이 된다. */}
      <p className="mt-1.5 text-xs leading-relaxed text-menu">
        내 평균보다 <b className="font-bold text-foreground">잘한 맵은 오른쪽</b>, 못한 맵은 왼쪽으로
        뻗습니다.
      </p>

      {stats.length === 0 ? (
        <p className="mt-3.5 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-4 py-8 text-center text-sm text-menu">
          아직 맵별로 나눠 볼 기록이 없습니다.
        </p>
      ) : (
        <ul className="mt-3.5 rounded-2xl border border-white/[0.06] bg-[#1B1B23] px-5 pb-2 pt-3">
          {/* 가운데선이 무엇인지는 선 바로 위에 적는다. 칸 밖에 문장으로 적어두면
              읽는 사람이 그 문장과 선을 눈으로 이어붙여야 한다. */}
          <li aria-hidden="true" className="grid grid-cols-[3.5rem_1fr_auto] items-end gap-4 pb-1">
            <span />
            <span className="relative block h-4">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none text-menu">
                내 평균 {overall.overallAvgRank.toFixed(1)}등
              </span>
            </span>
            <span className="min-w-[6.5rem] text-right text-[11px] leading-none text-subtext">
              평균등수 차이
            </span>
          </li>

          {stats.map((stat) => (
            <MapRow key={stat.mapName} stat={stat} />
          ))}
        </ul>
      )}
    </div>
  );
}
