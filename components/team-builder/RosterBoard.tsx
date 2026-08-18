import type { Roster, RosterEntry } from '@/lib/scrimRoster';
import { cleanDisplayName } from '@/lib/memberStats';

const TIER_SLOT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '1티어 (0~1.5)',
  2: '2티어 (2~2.5)',
  3: '3티어 (3~3.5)',
  4: '4티어 (4~5)',
};

// 괄호 태그·이모지·부계정 표기를 뗀 "Ez_XXXX" 형태만 보여준다 — 클랜원 페이지와
// 같은 정리 규칙(lib/memberStats.ts의 cleanDisplayName)을 그대로 쓴다.
function displayName(entry: RosterEntry): string {
  return entry.discordNickname ? cleanDisplayName(entry.discordNickname) : '(닉네임 정보 없음)';
}

export function RosterBoard({ roster }: { roster: Roster | null }) {
  if (!roster) {
    return <p className="mt-10 text-menu">아직 업로드된 명단이 없습니다. 파일을 업로드하세요.</p>;
  }

  const matched = roster.entries.filter((entry) => entry.matched);
  const unmatched = roster.entries.filter((entry) => !entry.matched);

  return (
    <div>
      <p className="hud text-xs text-menu">
        마지막 갱신: {new Date(roster.fetchedAt).toLocaleString('ko-KR')}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {([1, 2, 3, 4] as const).map((slot) => {
          const slotEntries = matched.filter((entry) => entry.tierSlot === slot);
          return (
            <section key={slot} className="clip-corner border border-white/10 bg-white/[0.03] p-4">
              <h3 className="hud text-xs text-accent">
                {TIER_SLOT_LABELS[slot]} — {slotEntries.length}/16명
              </h3>
              <ul className="mt-3 space-y-1">
                {slotEntries.map((entry) => (
                  <li key={entry.id} className="truncate text-sm text-foreground">
                    {displayName(entry)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-8">
        <h3 className="hud text-xs text-menu">미매칭 ({unmatched.length})</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {unmatched.map((entry) => (
            <li key={entry.id} className="rounded-md border border-white/10 px-3 py-1 text-xs text-menu">
              {displayName(entry)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
