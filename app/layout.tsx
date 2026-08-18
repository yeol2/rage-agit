import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAGE AGIT',
  description: '배틀그라운드 클랜 RAGE의 내전 전적 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="relative overflow-x-hidden bg-background text-foreground">
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
