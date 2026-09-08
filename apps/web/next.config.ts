import type { NextConfig } from "next";
import path from "node:path";

/**
 * WEMOVE · 前台 Next.js 配置
 * - 开发期将 /api/v1/* 代理到本地 API（apps/api，默认 8080），前后端同源、免 CORS；
 *   生产部署时用 Nginx 反向代理做同样的事（见 infra 说明），或直接配置 API_PROXY_TARGET。
 */
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"], qualities: [60, 75] },
  async redirects() {
    return [
      { source: "/catalog", destination: "/products", permanent: true },
      { source: "/help", destination: "/support", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
