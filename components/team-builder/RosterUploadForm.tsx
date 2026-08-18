'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function RosterUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matchedCount: number; totalCount: number } | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/scrim-roster/upload', { method: 'POST', body: formData });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? '업로드에 실패했습니다.');
        return;
      }

      setResult({ matchedCount: body.matchedCount, totalCount: body.totalCount });
      router.refresh();
    } catch {
      setError('업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="clip-corner cursor-pointer border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-foreground hover:border-accent">
        {loading ? '업로드 중...' : '명단 파일 업로드 (.csv, .txt)'}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <p className="text-sm text-menu">
          {result.totalCount}명 중 {result.matchedCount}명 매칭됨
        </p>
      )}
    </div>
  );
}
