import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// 单测若触达 PrismaService 构造：无 .env 时给默认连接串（连接惰性，离线可跑纯逻辑单测）
process.env.DATABASE_URL ??=
  'postgresql://wemove:wemove_dev@localhost:5432/wemove?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'dev_only_change_me_wemove_access';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
