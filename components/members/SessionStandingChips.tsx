import { medalRank, type RecentSession } from '@/lib/memberDashboard';

// 칸 하나는 언제나 [뱃지 / 등수 / 날짜] 세 줄이고 **세 줄의 높이가 고정**이다.
// 메달이 있든 없든, 아예 안 나왔든 글자 자리가 흔들리지 않게 하려는 것이다.
const MEDAL_SRC: Record<1 | 2 | 3, string> = {
  1: '/medals/gold.png',
  2: '/medals/silver.png',
  3: '/medals/bronze.png',
};

// 테두리·배경은 티어 네임플레이트와 같은 어법(옅은 그라디언트 + 또렷한 테두리)이고,
// 뱃지 자리만 메달 그림이 받는다.
const MEDAL_CHIP_CLASS: Record<1 | 2 | 3, string> = {
  1: 'border-[rgba(255,211,101,0.6)] bg-[linear-gradient(180deg,rgba(255,211,101,0.2),rgba(255,211,101,0.04))]',
  2: 'border-[rgba(215,215,218,0.55)] bg-[linear-gradient(180deg,rgba(215,215,218,0.18),rgba(215,215,218,0.04))]',
  3: 'border-[rgba(192,143,78,0.55)] bg-[linear-gradient(180deg,rgba(192,143,78,0.2),rgba(192,143,78,0.05))]',
};

const MEDAL_TEXT_CLASS: Record<1 | 2 | 3, string> = {
  1: 'text-[#FFD365]',
  2: 'text-[#E4E4E6]',
  3: 'text-[#DFA45F]',
};

export interface SessionStandingChipsProps {
  sessions: RecentSession[];
  /** 날짜 → 그날 종합등수. 없는 날짜는 그 사람이 안 나온 회차다. */
  standingByDate: Map<string, number>;
  compact?: boolean;
}

export function SessionStandingChips({
  sessions,
  standingByDate,
  compact = false,
}: SessionStandingChipsProps) {
  const badgeHeight = compact ? 22 : 26;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="session-standing-chips">
      {sessions.map((session) => {
        const standing = standingByDate.get(session.scrimDate);
        const medal = standing === undefined ? null : medalRank(standing);

        return (
          <div
            key={session.scrimDate}
            data-testid={`standing-chip-${session.scrimDate}`}
            className={`min-w-[66px] flex-1 shrink-0 rounded-xl border py-2 text-center ${
              medal
                ? MEDAL_CHIP_CLASS[medal]
                : standing === undefined
                  ? 'border-white/5 bg-white/[0.02]'
                  : 'border-white/[0.07] bg-[#23232C]'
            }`}
          >
            <div
              className="mb-[5px] flex items-center justify-center"
              style={{ height: badgeHeight }}
            >
              {medal ? (
                // eslint-disable-next-line @next/next/no-img-element -- 목록 안 작은 아이콘이라 next/image 의 최적화가 이득이 없다
                <img
                  src={MEDAL_SRC[medal]}
                  alt=""
                  style={{ height: badgeHeight }}
                  className="w-auto"
                />
              ) : standing === undefined ? null : (
                <span className={compact ? 'text-[15px]' : 'text-[18px]'} aria-hidden="true">
                  💩
                </span>
              )}
            </div>

            <div
              className={`h-5 text-xl font-bold leading-none tabular-nums ${
                medal
                  ? MEDAL_TEXT_CLASS[medal]
                  : standing === undefined
                    ? 'font-bold text-subtext'
                    : 'text-foreground'
              }`}
            >
              {standing === undefined ? (
                '-'
              ) : (
                <>
                  {standing}
                  <span className="ml-px text-[11px] font-bold opacity-70">위</span>
                </>
              )}
            </div>

            <div className="mt-[7px] h-3.5 text-[11px] font-semibold leading-[14px] tracking-tight text-menu tabular-nums">
              {session.label}
            </div>

            <span className="sr-only">
              {session.label} {standing === undefined ? '불참' : `종합 ${standing}위`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
