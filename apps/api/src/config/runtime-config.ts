const DEVELOPMENT_JWT_SECRET = 'dev_only_change_me_wemove_access';

type RuntimeEnv = Record<string, string | undefined>;

function requireValue(env: RuntimeEnv, name: string, errors: string[]) {
  if (!env[name]?.trim()) errors.push(`${name} is required`);
}

function requirePositiveInteger(env: RuntimeEnv, name: string, errors: string[]) {
  const raw = env[name];
  if (raw === undefined || raw === '') return;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) errors.push(`${name} must be a positive integer`);
}

/**
 * 启动前校验高风险配置。开发环境保留离线友好的默认值；生产环境必须显式配置。
 * 抛出的错误仅出现在服务端启动日志，不进入 HTTP 响应。
 */
export function assertRuntimeConfig(env: RuntimeEnv = process.env): void {
  const errors: string[] = [];

  requirePositiveInteger(env, 'PORT', errors);
  requirePositiveInteger(env, 'GLOBAL_RATE_LIMIT_PER_MIN', errors);
  requirePositiveInteger(env, 'SMTP_PORT', errors);

  if (env.NODE_ENV === 'production') {
    requireValue(env, 'DATABASE_URL', errors);
    requireValue(env, 'REDIS_URL', errors);
    requireValue(env, 'SMTP_HOST', errors);
    requireValue(env, 'APP_BASE_URL', errors);

    const jwtSecret = env.JWT_ACCESS_SECRET?.trim() ?? '';
    if (jwtSecret.length < 32 || jwtSecret === DEVELOPMENT_JWT_SECRET) {
      errors.push('JWT_ACCESS_SECRET must be a non-default secret with at least 32 characters');
    }

    const appBaseUrl = env.APP_BASE_URL?.trim();
    if (appBaseUrl && !appBaseUrl.startsWith('https://')) {
      errors.push('APP_BASE_URL must use https:// in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid runtime configuration:\n- ${errors.join('\n- ')}`);
  }
}
