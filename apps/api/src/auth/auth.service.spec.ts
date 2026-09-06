import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type { EmailService } from '../email/email.service.js';
import type { JwtService } from '@nestjs/jwt';

describe('AuthService login lockout', () => {
  it('锁定窗口内在读取账号前拒绝登录，正确密码也不能绕过', async () => {
    const findUnique = vi.fn();
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const redis = {
      incrWithTtl: vi.fn().mockResolvedValue(1),
      getNumber: vi.fn().mockResolvedValue(5),
    } as unknown as RedisService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      {} as AuditService,
      redis,
      {} as EmailService,
    );

    await expect(
      service.login({ email: 'locked@example.com', password: 'CorrectPass123!' }, '127.0.0.1'),
    ).rejects.toMatchObject({ status: 429, response: { code: 42900 } });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
