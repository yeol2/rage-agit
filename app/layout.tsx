import type { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { AdminProvider } from '@/components/admin/AdminProvider';

export const metadata: Metadata = {
  title: 'RAGE AGIT',
  description: '배틀그라운드 클랜 RAGE의 내전 전적 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="relative overflow-x-hidden bg-background text-foreground">
        <AdminProvider>
          <div className="relative">{children}</div>
        </AdminProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
