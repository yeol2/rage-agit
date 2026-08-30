import Link from 'next/link';
import { MIN_SESSIONS_TOGETHER, displayedDelta, type PartnerCard } from '@/lib/partnerStats';

// 같은 팀이었을 때 성적이 가장 좋아진 사람과 가장 나빠진 사람을 한 줄에 나란히
// 놓는다. 두 칸의 뼈대(테두리 상자·머리말·차이·이름 목록)는 완전히 같다 —
// 같은 계산의 양 끝이라는 걸 구조로 말하고, 성격은 색과 빛으로만 가른다.
//
// 빛의 방향이 이 디자인의 전부다. 깐부 칸은 **위에서** 내려오는 금빛 후광이고
// 반대편 칸은 **아래에서** 올라오는 붉은 잉걸불이다. 천사/악마를 뿔이나 날개
// 같은 그림으로 그리면 지표 화면에서 장난스러워지는데, 조명 방향만 뒤집으면
// 한눈에 읽히면서도 나머지 카드들과 같은 어법으로 남는다.
//
// 한 칸에 여러 명이 올 수 있다. 등수 차이가 화면에 같은 숫자로 찍히는 사람은
// 전부 같이 세운다(lib/partnerStats.ts 의 displayedDelta 참고).

type Side = 'best' | 'worst';

interface SideStyle {
  label: string;
  emoji: string;
  verb: string;
  arrow: string;
  /** 강조 글자색(등수 차이). */
  accent: string;
  border: string;
  /** 카드 바탕. 깐부는 위가 밝고, 반대편은 아래가 밝다. */
  surface: string;
  /** 그 위에 겹치는 빛. 아주 느리게 숨 쉰다(.partner-aura). */
  aura: string;
  /** 빛이 들어오는 모서리에 긋는 가는 선. 조명 방향을 한 번 더 못 박는다. */
  edgeClass: string;
  edge: string;
  /** 이모지를 담는 동그란 칩. */
  chipBackground: string;
  chipShadow: string;
}

const SIDE_STYLE: Record<Side, SideStyle> = {
  best: {
    label: '나의 깐부',
    emoji: '😇',
    verb: '좋아짐',
    arrow: '▲',
    accent: '#FFDE9F',
    border: 'rgba(255,224,160,0.34)',
    // 금색을 그대로 얹으면 티어 배경(자주빛) 위에서 갈색으로 가라앉는다.
    // 흰색 쪽으로 당긴 상아빛이라야 '빛'으로 읽힌다.
    surface: 'linear-gradient(180deg, rgba(255,242,208,0.13), rgba(255,242,208,0.012))',
    aura: 'radial-gradient(115% 72% at 50% -12%, rgba(255,247,222,0.38), rgba(255,247,222,0) 66%)',
    edgeClass: 'inset-x-5 top-0',
    edge: 'linear-gradient(90deg, rgba(255,247,222,0), rgba(255,247,222,0.75), rgba(255,247,222,0))',
    chipBackground: 'rgba(255,228,170,0.14)',
    chipShadow: '0 0 0 1px rgba(255,228,170,0.45), 0 0 16px rgba(255,222,158,0.38)',
  },
  worst: {
    label: '다시는 보지 말자',
    emoji: '😈',
    verb: '나빠짐',
    arrow: '▼',
    accent: '#FF8B76',
    border: 'rgba(255,92,74,0.34)',
    surface: 'linear-gradient(0deg, rgba(255,64,48,0.13), rgba(255,64,48,0.012))',
    aura: 'radial-gradient(115% 72% at 50% 112%, rgba(255,74,54,0.34), rgba(255,74,54,0) 66%)',
    edgeClass: 'inset-x-5 bottom-0',
    edge: 'linear-gradient(90deg, rgba(255,104,84,0), rgba(255,104,84,0.75), rgba(255,104,84,0))',
    chipBackground: 'rgba(255,74,54,0.16)',
    chipShadow: '0 0 0 1px rgba(255,104,84,0.5), 0 0 16px rgba(255,70,50,0.42)',
  },
};

function PartnerSlot({ side, cards }: { side: Side; cards: PartnerCard[] }) {
  const style = SIDE_STYLE[side];
  const filled = cards.length > 0;

  return (
    <div
      data-testid={`partner-${side}`}
      className={`relative min-w-0 overflow-hidden rounded-2xl border px-4 py-3.5 ${
        // 후보가 없는 칸은 색을 입히지 않는다 — 빈 칸까지 빛나면 무엇이 실제
        // 결과인지 흐려진다.
        filled ? '' : 'border-white/5 bg-white/[0.02]'
      }`}
      style={filled ? { borderColor: style.border, background: style.surface } : undefined}
    >
      {filled && (
        <>
          <span
            aria-hidden="true"
            className="partner-aura pointer-events-none absolute inset-0"
            style={{ background: style.aura }}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute h-px ${style.edgeClass}`}
            style={{ background: style.edge }}
          />
        </>
      )}

      {/* 빛은 배경이고 내용은 그 위다 — 겹침 순서를 명시하지 않으면 aura 가
          글자를 덮는다. */}
      <div className="relative">
        <p className="mb-2.5 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px]"
            style={
              filled
                ? { background: style.chipBackground, boxShadow: style.chipShadow }
                : { background: 'rgba(255,255,255,0.04)' }
            }
          >
            {style.emoji}
          </span>
          {/* 이 칸이 무슨 칸인지가 카드에서 가장 먼저 읽혀야 한다. 안쪽 글자들과
              같은 크기로 두면 머리말이 목록에 묻혀 어느 쪽이 깐부인지 한눈에
              들어오지 않는다. */}
          <span
            className="hud truncate text-[13px] font-bold"
            style={{ color: filled ? style.accent : undefined }}
          >
            {style.label}
          </span>
        </p>

        {!filled ? (
          // 후보가 없는 쪽은 빈 칸으로 두지 않고 왜 없는지를 적는다 — 이름 자리가
          // 그냥 비어 있으면 기록이 없는 건지 계산이 깨진 건지 알 수 없다.
          <p className="py-1.5 text-[13px] leading-snug text-subtext">
            아직 내전 {MIN_SESSIONS_TOGETHER}회 이상 같은 팀이었던 사람이 없습니다.
          </p>
        ) : (
          <>
            {/* 등수 차이는 이 칸에 선 사람들이 공유하는 값이라 위에 한 번만 적는다. */}
            <p className="text-sm font-bold tabular-nums" style={{ color: style.accent }}>
              <span aria-hidden="true">{style.arrow}</span>{' '}
              {Math.abs(displayedDelta(cards[0].rankDelta)).toFixed(1)}등
              <span className="ml-1 font-semibold text-menu">{style.verb}</span>
            </p>

            <ul className="mt-2 space-y-2">
              {cards.map((card) => (
                <li key={card.partnerId} className="min-w-0">
                  {/* 이름을 누르면 그 사람 페이지로 간다 — 궁합을 보면 상대가 어떤
                      사람인지 바로 궁금해지는 자리다. */}
                  <Link
                    href={`/members/${card.partnerId}`}
                    className="block truncate text-lg font-bold leading-tight tracking-tight transition-colors hover:text-white/70"
                  >
                    {card.displayName}
                  </Link>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-menu tabular-nums">
                    내전 {card.sessionsTogether}회({card.gamesTogether}경기) 함께 · 평균{' '}
                    {card.avgRankTogether.toFixed(1)}등
                    <br />
                    <span className="text-subtext">
                      같은 팀이 아닐 땐 {card.avgRankApart.toFixed(1)}등
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export interface PartnerChemistryProps {
  best: PartnerCard[];
  worst: PartnerCard[];
}

export function PartnerChemistry({ best, worst }: PartnerChemistryProps) {
  return (
    <div data-testid="partner-chemistry">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="hud text-xs text-menu">같은 팀일 때</p>
        {/* 표본이 얇은 지표라 자격선을 화면에 적어둔다 — 왜 저 사람이 뽑혔는지,
            왜 어떤 사람은 안 나오는지가 여기서 다 설명된다. */}
        <span className="text-[11px] text-subtext">
          내전 {MIN_SESSIONS_TOGETHER}회 이상 함께한 사람만
        </span>
      </div>

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        <PartnerSlot side="best" cards={best} />
        <PartnerSlot side="worst" cards={worst} />
      </div>
    </div>
  );
}
