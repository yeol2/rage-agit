import Image from 'next/image';
import { siteConfig } from '@/lib/siteConfig';

/**
 * 로고는 언제든 교체할 수 있어야 하므로 파일 경로를 siteConfig.logo 에 둔다.
 * src 가 비어 있으면 기본 다이아몬드 마크로 폴백한다.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const { src, alt, width, height } = siteConfig.logo;

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority
        className="h-7 w-auto shrink-0"
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M16 2 L30 16 L16 30 L2 16 Z" stroke="#FF9233" strokeWidth="1.6" />
      <path d="M16 9 L23 16 L16 23 L9 16 Z" fill="#FF9233" />
    </svg>
  );
}
