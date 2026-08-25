import { siteConfig } from '@/lib/siteConfig';

// 트로피를 늘어놓아 우승 횟수를 보여준다. 다만 시즌이 이어지면 횟수가 계속
// 늘어나므로, 한 줄을 넘길 만큼 많아지면 트로피 하나만 두고 숫자에 맡긴다.
const MAX_GLYPHS = 8;

export function WinTrophies({ count }: { count: number }) {
  // 우승이 없으면 아무것도 안 그린다 — 빈 자리를 "0회"로 채우면 육각형 지표
  // 위에 의미 없는 줄만 하나 늘어난다.
  if (count <= 0) return null;

  const { trophy, label } = siteConfig.memberDirectory.wins;

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-sm text-menu">
      <span aria-hidden className="tracking-tight">
        {count <= MAX_GLYPHS ? trophy.repeat(count) : trophy}
      </span>
      <span>{label(count)}</span>
    </p>
  );
}
