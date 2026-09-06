import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import { RedisService } from '../redis/redis.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';

const ISSUER = 'WEMOVE SPORTS Admin';

/**
 * TOTP 二次认证服务（组长，otplib v13）：
 * - 密钥 base32；verify 校验当前时间步（默认无容差窗口，若需要可传 window: [past, future]）
 * - 校验带失败限流：单员工连续 5 次错误锁 15 分钟（Redis 降级时仅校验不计数）
 */
@Injectable()
export class MfaService {
  constructor(private readonly redis: RedisService) {}

  /** 生成新密钥 + otpauth URL（供二维码/手工录入） */
  createSetup(accountEmail: string): { secret: string; otpauthUrl: string } {
    const secret = generateSecret();
    return { secret, otpauthUrl: generateURI({ issuer: ISSUER, label: accountEmail, secret }) };
  }

  /** 校验 6 位动态码（格式非法/校验失败均返回 false，不抛错） */
  async verifyCode(code: string, secret: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    try {
      const result = await verify({ secret, token: code });
      return result.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * 限流校验（守卫/敏感操作入口调用）：成功返回 true；
   * 错误码 → MFA_INVALID(40301)；连续失败达上限 → 429；Redis 不可用时仅做校验。
   */
  async verifyWithLimit(staffId: string, code: string, secret: string): Promise<boolean> {
    const key = `wm:rl:mfa:${staffId}`;
    const previousFailures = await this.redis.getNumber(key);
    if (previousFailures !== null && previousFailures >= 5) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many MFA attempts, try again in 15 minutes',
        429,
      );
    }
    const ok = await this.verifyCode(code, secret);
    if (!ok) {
      const failures = await this.redis.incrWithTtl(key, 900);
      if (failures !== null && failures >= 5) {
        throw new BizException(
          ERROR_CODES.RATE_LIMIT,
          'too many MFA attempts, try again in 15 minutes',
          429,
        );
      }
      throw new BizException(ERROR_CODES.MFA_INVALID, 'invalid MFA code', 403);
    }
    await this.redis.del(key);
    return true;
  }
}
