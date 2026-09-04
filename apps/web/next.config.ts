import type { NextConfig } from 'next';

/**
 * WEMOVE SPORTS · 前台 Next.js 配置
 * - 开发期将 /api/v1/* 代理到本地 API（apps/api，默认 8080），前后端同源、免 CORS；
 *   生产部署时用 Nginx 反向代理做同样的事（见 infra 说明），或直接配置 API_PROXY_TARGET。
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
