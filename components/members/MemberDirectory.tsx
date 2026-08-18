'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ALL_TIERS,
  cleanDisplayName,
  stripTrailingKoreanTag,
  tierColorRamp,
  type MemberSummary,
} from '@/lib/memberStats';

export function MemberDirectory({ members }: { members: MemberSummary[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => member.discordNickname.toLowerCase().includes(needle));
  }, [members, query]);

  const grouped = useMemo(() => {
    return ALL_TIERS.map((tier) => ({
      tier,
      members: filtered.filter((member) => member.tier === tier),
    })).filter((entry) => entry.members.length > 0);
  }, [filtered]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="닉네임 검색"
        className="w-full max-w-xs rounded-md border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
      />

      {grouped.length === 0 && <p className="mt-10 text-menu">일치하는 클랜원이 없습니다.</p>}

      {grouped.map(({ tier, members: tierMembers }) => (
        <section key={tier} className="mt-8">
          <h3 className="hud text-xs text-accent">{tier}티어</h3>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {tierMembers.map((member) => {
              const ramp = tierColorRamp(member.tier);
              return (
                <li key={member.id}>
                  <Link
                    href={`/members/${member.id}`}
                    className="block truncate rounded-md border px-3 py-2 text-xs text-foreground transition-transform hover:scale-[1.03]"
                    style={{
                      background: `linear-gradient(135deg, ${ramp.from}26, ${ramp.to}26)`,
                      borderColor: `${ramp.from}66`,
                      boxShadow: `0 0 10px ${ramp.from}40`,
                    }}
                  >
                    {stripTrailingKoreanTag(cleanDisplayName(member.discordNickname))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
