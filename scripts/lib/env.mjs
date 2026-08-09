// .env.local 을 읽어 process.env 에 채운다.
// 이미 설정된 환경변수는 덮어쓰지 않는다 — CI 등에서 직접 넘긴 값이 우선이다.

import { readFileSync } from 'node:fs';

export function loadEnvLocal(path = '.env.local') {
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return; // 파일이 없으면 환경변수로 직접 넘겼다고 보고 넘어간다
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

// 없으면 즉시 실패시킨다. 값은 절대 로그에 찍지 않는다.
export function requireEnv(...keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`.env.local 에 다음 값이 필요합니다: ${missing.join(', ')}`);
    process.exit(1);
  }
  return keys.map((k) => process.env[k]);
}
