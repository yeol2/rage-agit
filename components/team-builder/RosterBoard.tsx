import Link from 'next/link';
import type { Roster, RosterEntry } from '@/lib/scrimRoster';
import { cleanDisplayName, stripTrailingKoreanTag, tierNameplateStyle } from '@/lib/memberStats';

const TIER_SLOT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '1티어 (0~1.5)',
  2: '2티어 (2~2.5)',
  3: '3티어 (3~3.5)',
  4: '4티어 (4~5)',
};

// 괄호 태그·이모지·부계정 표기·뒤에 붙은 한글 장식을 뗀 "Ez_XXXX" 형태만 보여준다 —
// 클랜원 페이지(MemberDirectory)와 같은 정리 규칙을 그대로 쓴다.
function displayName(entry: RosterEntry): string {
  if (!entry.discordNickname) return '(닉네임 정보 없음)';
  return stripTrailingKoreanTag(cleanDisplayName(entry.discordNickname));
}

// 클랜원 페이지와 같은 티어 색 네임플레이트. 매칭된 사람만 티어가 있어 색을 입힐 수
// 있고, member_id 도 있어 개인 페이지로 링크한다 — 미매칭은 그냥 텍스트로 둔다.
function Nameplate({ entry }: { entry: RosterEntry }) {
  const name = displayName(entry);

  if (!entry.matched || entry.tier === null || !entry.memberId) {
    return (
      <span className="block truncate rounded-md border border-white/10 px-3 py-2 text-xs text-menu">
        {name}
      </span>
    );
  }

  return (
    <Link
      href={`/members/${entry.memberId}`}
      className="block truncate rounded-md border-2 px-3 py-2 text-xs text-foreground transition-transform hover:scale-[1.03]"
      style={tierNameplateStyle(entry.tier)}
    >
      {name}
    </Link>
  );
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
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {slotEntries.map((entry) => (
                  <li key={entry.id}>
                    <Nameplate entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-8">
        <h3 className="hud text-xs text-menu">미매칭 ({unmatched.length})</h3>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {unmatched.map((entry) => (
            <li key={entry.id}>
              <Nameplate entry={entry} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
