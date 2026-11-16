/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 빌드 때 페이지를 몇 개씩 동시에 만드나. Next 기본값은 "코어 수 - 1"이라 Vercel 빌드
    // 머신(2코어)에서는 1개씩 — 클랜원 페이지 272개를 하나씩 만들어서 배포가 4~5분 걸렸다
    // (2026-11-14 06ffdb7 부터). 페이지 하나는 Supabase 응답을 기다리는 시간이 대부분이라
    // 코어보다 많이 띄워도 된다. 빌드 머신 메모리는 8GB.
    cpus: 8,
  },
};

export default nextConfig;
