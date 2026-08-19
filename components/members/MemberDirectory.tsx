'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ALL_TIERS,
  cleanDisplayName,
  stripTrailingKoreanTag,
  tierNameplateStyle,
  type MemberSummary,
} from '@/lib/memberStats';
import { VipCrown } from '@/components/VipCrown';

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

  // VIP는 자기 티어 섹션에서도 그대로 보인다 — 여기 목록은 추가로 등수 순 보여주는
  // 것뿐이라 grouped 필터링과 무관하게 별도로 뽑는다.
  const vips = useMemo(() => {
    return filtered
      .filter((member): member is MemberSummary & { vipRank: number } => member.vipRank !== null)
      .sort((a, b) => a.vipRank - b.vipRank);
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

      {vips.length > 0 && (
        <section className="mt-8">
          <h3 className="hud text-xs text-white">VIP</h3>
          {/* 등수는 팀 구성(내전) 쪽에서나 중요하지 여기선 그냥 나열한다 — 순서만
              등수 순으로 두고 숫자 배지는 안 보여준다. */}
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {vips.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/members/${member.id}`}
                  className="vip-holographic block truncate rounded-md px-3 py-2 text-xs font-bold text-[#1a1622] transition-transform hover:scale-[1.03]"
                >
                  {stripTrailingKoreanTag(cleanDisplayName(member.discordNickname))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grouped.length === 0 && <p className="mt-10 text-menu">일치하는 클랜원이 없습니다.</p>}

      {grouped.map(({ tier, members: tierMembers }) => (
        <section key={tier} className="mt-8">
          <h3 className="hud text-xs text-white">{tier}티어</h3>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {tierMembers.map((member) => (
              <li key={member.id} className="relative">
                <Link
                  href={`/members/${member.id}`}
                  className="block truncate rounded-md border px-3 py-2 text-xs transition-transform hover:scale-[1.03]"
                  style={tierNameplateStyle(member.tier)}
                >
                  {stripTrailingKoreanTag(cleanDisplayName(member.discordNickname))}
                </Link>
                {member.vipRank !== null && <VipCrown />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
