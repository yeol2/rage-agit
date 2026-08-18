import type { Roster, RosterEntry } from '@/lib/scrimRoster';
import { cleanDisplayName } from '@/lib/memberStats';

const TIER_SLOT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '1티어 (0~1.5)',
  2: '2티어 (2~2.5)',
  3: '3티어 (3~3.5)',
  4: '4티어 (4~5)',
};

// cleanDisplayName 은 괄호 밖에 붙은 한글 태그("Ez_Gimli 김리", "Ez_Jhoney주헌")는
// 못 뗀다 — 클랜원 페이지엔 없는 케이스라 공용 함수를 안 건드리고 여기서만 추가로
// 뒤쪽 한글 덩어리를 잘라낸다. 결과가 통째로 비면(닉네임이 한글뿐인 경우) 자르지 않는다.
function stripTrailingKorean(name: string): string {
  const stripped = name.replace(/\s*[가-힣]+$/, '').trim();
  return stripped.length > 0 ? stripped : name;
}

// 괄호 태그·이모지·부계정 표기를 뗀 "Ez_XXXX" 형태만 보여준다 — 클랜원 페이지와
// 같은 정리 규칙(lib/memberStats.ts의 cleanDisplayName)을 기본으로 쓰고, 이 화면
// 전용으로 뒤쪽 한글 태그까지 마저 없앤다.
function displayName(entry: RosterEntry): string {
  if (!entry.discordNickname) return '(닉네임 정보 없음)';
  return stripTrailingKorean(cleanDisplayName(entry.discordNickname));
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
