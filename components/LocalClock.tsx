'use client';

import { useEffect, useState } from 'react';

export function LocalClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 서버 렌더링 시점에는 시간을 비워둬야 hydration 불일치가 나지 않는다.
  return <span className="tabular-nums text-foreground">{time ?? '--:--:--'}</span>;
}
