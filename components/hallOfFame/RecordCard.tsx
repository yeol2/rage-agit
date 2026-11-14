import { TierBadge } from '@/components/TierBadge';
import type { RecordBoard, RecordPlayer } from '@/lib/hallOfFame';

function teamNames(players: RecordPlayer[]): string {
  return players.map((p) => p.name).join(' · ');
}

// 명예의 전당 카드 하나 — 기록 하나의 1~10등.
// 메달은 내전 기록·리더보드와 같은 금·은·동 색을 쓴다.

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatValue(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function RecordCard({ board }: { board: RecordBoard }) {
  return (
    <section
      data-testid={`record-${board.id}`}
      className="rounded-2xl border border-white/[0.06] bg-[#1B1B23] p-4 sm:p-5"
    >
      <h2 className="text-base font-bold text-foreground">{board.title}</h2>
      <p className="mt-1 text-xs text-menu">{board.description}</p>

      {board.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-menu">아직 기록이 없습니다.</p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {board.entries.map((entry, i) => (
            <li
              key={`${entry.date}-${teamNames(entry.players)}-${i}`}
              className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 ${
                entry.rank <= 3 ? 'bg-white/[0.04]' : ''
              }`}
            >
              <span className="text-center text-lg font-bold tabular-nums text-menu" aria-label={`${entry.rank}등`}>
                {MEDAL[entry.rank] ?? <span className="text-sm">{entry.rank}</span>}
              </span>
              <span className="min-w-0">
                {board.kind === 'player' ? (
                  // 개인 기록 — 이름 옆에 리더보드와 같은 티어 뱃지(지금 티어).
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{entry.players[0]?.name}</span>
                    {entry.players[0]?.tier != null && (
                      <TierBadge tier={entry.players[0].tier} className="shrink-0" />
                    )}
                  </span>
                ) : (
                  // 팀 기록 — 팀원은 고티어 → 저티어 순(lib/hallOfFame 의 byTier).
                  // 휴대폰에선 넷 이름이 한 줄에 안 들어가 잘리면 둘만 보인다 —
                  // 좁은 화면은 줄을 넘기고, 넓은 화면만 한 줄로 자른다.
                  <span
                    className="block text-sm font-bold text-foreground sm:truncate"
                    title={teamNames(entry.players)}
                  >
                    {teamNames(entry.players)}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] tabular-nums text-subtext">
                  {entry.date}
                  {entry.map && <span className="ml-1.5 text-menu">{entry.map}</span>}
                  {entry.detail && <span className="ml-1.5">· {entry.detail}</span>}
                </span>
              </span>
              <span className="text-right text-base font-bold tabular-nums text-foreground">
                {formatValue(entry.value)}
                <span className="ml-0.5 text-[11px] font-bold text-menu">{board.unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-right text-[10px] text-subtext">{board.since}부터 기록</p>
    </section>
  );
}
