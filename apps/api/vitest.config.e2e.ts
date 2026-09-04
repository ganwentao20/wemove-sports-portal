import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// e2e 会整体启动 AppModule（构造 PrismaService）：
// 本地/CI 无 .env 时给默认本地连接串 —— 仅保证可实例化，连接按需惰性发生。
process.env.DATABASE_URL ??=
  'postgresql://wemove:wemove_dev@localhost:5432/wemove?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'dev_only_change_me_wemove_access';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    hookTimeout: 20000,
  },
});
