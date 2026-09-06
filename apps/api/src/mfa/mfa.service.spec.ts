import { describe, expect, it } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { MfaService } from './mfa.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BizException } from '../common/errors.js';

/** 可控假 Redis：incr 返回递增计数；初始值可设为 4 触发下次即锁定 */
function fakeRedis(initial = 0): RedisService & { calls: string[] } {
  let count = initial;
  const calls: string[] = [];
  return {
    calls,
    async getNumber(key: string) {
      calls.push(`get:${key}`);
      return count;
    },
    async incrWithTtl(key: string) {
      calls.push(`incr:${key}`);
      count += 1;
      return count;
    },
    async del() {
      return true;
    },
  } as unknown as RedisService & { calls: string[] };
}

describe('MfaService (otplib v13)', () => {
  it('createSetup 生成 base32 密钥与 otpauth URL', () => {
    const service = new MfaService(fakeRedis());
    const setup = service.createSetup('admin@wemove.local');
    expect(setup.secret).toMatch(/^[A-Z2-7]+={0,2}$/);
    expect(setup.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    expect(setup.otpauthUrl).toContain('issuer=');
    expect(setup.otpauthUrl).toContain(setup.secret);
  });

  it('当前动态码校验通过；错误码/非法格式校验失败', async () => {
    const service = new MfaService(fakeRedis());
    const secret = generateSecret();
    const code = await generate({ secret });
    expect(await service.verifyCode(code, secret)).toBe(true);
    expect(await service.verifyCode('000000', secret)).toBe(false);
    expect(await service.verifyCode('abc', secret)).toBe(false);
  });

  it('verifyWithLimit 成功路径不增加失败计数并清除旧计数', async () => {
    const redis = fakeRedis();
    const service = new MfaService(redis);
    const secret = generateSecret();
    const code = await generate({ secret });
    const ok = await service.verifyWithLimit('staff-1', code, secret);
    expect(ok).toBe(true);
    expect(redis.calls).toContain('get:wm:rl:mfa:staff-1');
    expect(redis.calls).not.toContain('incr:wm:rl:mfa:staff-1');
  });

  it('错误码抛 MFA_INVALID(40301)', async () => {
    const service = new MfaService(fakeRedis());
    const secret = generateSecret();
    await expect(service.verifyWithLimit('staff-1', '000000', secret)).rejects.toMatchObject({
      status: 403,
      response: { code: 40301 },
    });
  });

  it('连续 5 次失败触发锁定（429 RATE_LIMIT）', async () => {
    const service = new MfaService(fakeRedis(4)); // 本次为第 5 次尝试
    const secret = generateSecret();
    let thrown: unknown = null;
    try {
      await service.verifyWithLimit('staff-1', '000000', secret);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(BizException);
    expect((thrown as BizException).getStatus()).toBe(429);
  });

  it('已有 4 次失败时，正确动态码仍可通过并清零', async () => {
    const redis = fakeRedis(4);
    const service = new MfaService(redis);
    const secret = generateSecret();
    const code = await generate({ secret });
    await expect(service.verifyWithLimit('staff-1', code, secret)).resolves.toBe(true);
    expect(redis.calls).not.toContain('incr:wm:rl:mfa:staff-1');
  });
});
