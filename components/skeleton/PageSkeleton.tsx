import { Nav } from '@/components/Nav';

// 페이지 전환 로딩 화면의 재료. 각 경로의 loading.tsx 가 이걸로 그 페이지 모양을
// 대충 흉내낸다 — 탭을 누르는 즉시 화면이 바뀌어야 "눌렸다"가 보인다.
// 메뉴바는 진짜를 그린다. 누른 탭이 바로 켜져서(usePathname 이 이미 새 경로다)
// 어디로 가는 중인지까지 보인다.

/** 흐르는 회색 박스 하나. 크기·모양은 className 으로. */
export function Bone({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  // 모서리를 따로 줬으면(rounded-full 등) 기본 rounded-md 를 안 붙인다 — 둘 다
  // 붙이면 CSS 순서상 rounded-md 가 이겨서 알약 모양이 네모가 된다.
  const rounding = /\brounded-/.test(className) ? '' : 'rounded-md';
  return <div aria-hidden="true" className={`skeleton ${rounding} ${className}`} style={style} />;
}

/** 다른 페이지 제목 자리(작은 영문 라벨 + 가로줄 + 큰 제목)와 같은 높이·간격. */
export function HeadingBones() {
  return (
    <>
      <div className="flex items-center gap-4">
        {/* 실제 라벨(hud text-xs)은 줄높이 16px, 제목(text-4xl)은 40px — 여기가
            어긋나면 아래 내용이 전부 그만큼 밀린다. */}
        <Bone className="h-4 w-24" />
        <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
      </div>
      <Bone className="mt-6 h-9 w-40 md:h-10" />
    </>
  );
}

export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    // 실제 페이지는 전부 화면보다 길어 세로 스크롤바가 있다. 뼈대가 짧아 스크롤바가
    // 없으면 가운데 정렬 기준 폭이 달라져, 진짜 화면으로 바뀔 때 전체가 옆으로 7px 튄다.
    <main style={{ minHeight: 'calc(100vh + 1px)' }}>
      <Nav />
      <section className="mx-auto max-w-shell px-5 py-16 sm:px-8" aria-busy="true">
        {/* 화면에 글은 안 띄운다 — 보통 1초 안에 끝나 읽기도 전에 사라진다.
            스크린리더에는 알린다. */}
        <p role="status" className="sr-only">
          불러오는 중
        </p>
        {children}
      </section>
    </main>
  );
}
