'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MEMBER_STAT_TIER_GROUPS, tierGroupFor, type MemberSummary } from '@/lib/memberStats';

export function MemberDirectory({ members }: { members: MemberSummary[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => member.discordNickname.toLowerCase().includes(needle));
  }, [members, query]);

  const grouped = useMemo(() => {
    return MEMBER_STAT_TIER_GROUPS.map((group) => ({
      group,
      members: filtered.filter((member) => tierGroupFor(member.tier)?.id === group.id),
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

      {grouped.map(({ group, members: groupMembers }) => (
        <section key={group.id} className="mt-10">
          <h3 className="hud text-xs text-accent">{group.label}</h3>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {groupMembers.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/members/${member.id}`}
                  className="block truncate rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground transition-colors hover:border-accent"
                >
                  {member.discordNickname}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
