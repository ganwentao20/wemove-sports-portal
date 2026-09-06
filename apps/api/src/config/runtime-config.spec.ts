import { describe, expect, it } from 'vitest';
import { assertRuntimeConfig } from './runtime-config.js';

describe('assertRuntimeConfig', () => {
  it('允许开发环境使用离线默认配置', () => {
    expect(() => assertRuntimeConfig({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('拒绝非法数值配置', () => {
    expect(() =>
      assertRuntimeConfig({ NODE_ENV: 'test', PORT: '0', GLOBAL_RATE_LIMIT_PER_MIN: 'NaN' }),
    ).toThrow(/PORT must be a positive integer/);
  });

  it('生产环境拒绝缺失依赖、弱 JWT 密钥与非 HTTPS 地址', () => {
    expect(() =>
      assertRuntimeConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev_only_change_me_wemove_access',
        APP_BASE_URL: 'http://example.com',
      }),
    ).toThrow(/DATABASE_URL is required/);
  });

  it('接受完整的生产配置', () => {
    expect(() =>
      assertRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@db:5432/wemove',
        REDIS_URL: 'redis://redis:6379',
        SMTP_HOST: 'mail.example.com',
        SMTP_PORT: '587',
        APP_BASE_URL: 'https://www.example.com',
        CORS_ORIGINS: 'https://www.example.com,https://admin.example.com',
        JWT_ACCESS_SECRET: 'a-unique-production-secret-of-32-characters',
        GLOBAL_RATE_LIMIT_PER_MIN: '1200',
        PORT: '8080',
      }),
    ).not.toThrow();
  });

  it('生产环境拒绝通配符或非 HTTPS CORS 来源', () => {
    expect(() =>
      assertRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@db:5432/wemove',
        REDIS_URL: 'redis://redis:6379',
        SMTP_HOST: 'mail.example.com',
        APP_BASE_URL: 'https://www.example.com',
        JWT_ACCESS_SECRET: 'a-unique-production-secret-of-32-characters',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/CORS_ORIGINS must contain only explicit https/);
  });
});
