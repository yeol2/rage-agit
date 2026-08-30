import Link from 'next/link';
import { MIN_SESSIONS_TOGETHER, displayedDelta, type PartnerCard } from '@/lib/partnerStats';

// 같은 팀이었을 때 성적이 가장 좋아진 사람과 가장 나빠진 사람을 한 줄에 나란히
// 놓는다. 두 칸은 완전히 같은 모양이고 색과 부호만 다르다 — 같은 계산의 양 끝
// 이라는 걸 생김새로 말하려는 것이다.
//
// 한 칸에 여러 명이 올 수 있다. 등수 차이가 화면에 같은 숫자로 찍히는 사람은
// 전부 같이 세운다(lib/partnerStats.ts 의 displayedDelta 참고).

type Side = 'best' | 'worst';

const SIDE_STYLE: Record<Side, { label: string; emoji: string; verb: string; arrow: string; accent: string; ring: string }> = {
  best: {
    label: '나의 사랑',
    emoji: '❤️',
    verb: '좋아짐',
    arrow: '▲',
    accent: 'text-[#7FE0A8]',
    ring: 'border-[rgba(127,224,168,0.32)] bg-[linear-gradient(180deg,rgba(127,224,168,0.08),rgba(127,224,168,0))]',
  },
  worst: {
    label: '다시는 보지 말자',
    emoji: '😡',
    verb: '나빠짐',
    arrow: '▼',
    accent: 'text-[#FF8A8A]',
    ring: 'border-[rgba(255,138,138,0.3)] bg-[linear-gradient(180deg,rgba(255,138,138,0.08),rgba(255,138,138,0))]',
  },
};

function PartnerSlot({ side, cards }: { side: Side; cards: PartnerCard[] }) {
  const style = SIDE_STYLE[side];

  return (
    <div
      data-testid={`partner-${side}`}
      className={`min-w-0 rounded-2xl border px-4 py-3.5 ${
        cards.length > 0 ? style.ring : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <p className="hud mb-1.5 text-[11px] text-menu">
        <span aria-hidden="true">{style.emoji}</span> {style.label}
      </p>

      {cards.length === 0 ? (
        // 후보가 없는 쪽은 빈 칸으로 두지 않고 왜 없는지를 적는다 — 이름 자리가
        // 그냥 비어 있으면 기록이 없는 건지 계산이 깨진 건지 알 수 없다.
        <p className="py-1.5 text-[13px] leading-snug text-subtext">
          아직 내전 {MIN_SESSIONS_TOGETHER}회 이상 같은 팀이었던 사람이 없습니다.
        </p>
      ) : (
        <>
          {/* 등수 차이는 이 칸에 선 사람들이 공유하는 값이라 위에 한 번만 적는다. */}
          <p className={`text-sm font-bold tabular-nums ${style.accent}`}>
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
