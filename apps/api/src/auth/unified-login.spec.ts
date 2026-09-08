import type { JwtService } from '@nestjs/jwt';
import type { Staff, User } from '@prisma/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEALER_TERMS_VERSION } from '../account/dealer-terms.js';
import type { AuditService } from '../audit/audit.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { B2bService } from '../dealer/b2b.service.js';
import type { DealerService } from '../dealer/dealer.service.js';
import type { EmailService } from '../email/email.service.js';
import type { MfaService } from '../mfa/mfa.service.js';
import type { InventoryService } from '../order/inventory.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { AuthService } from './auth.service.js';
import type { JwtPayload } from './auth.service.js';
import { hashPassword } from './passwords.util.js';

const customerPassword = 'CustomerPass123!';
const staffPassword = 'StaffPass456!';
let customerHash: string;
let staffHash: string;
beforeAll(async () => {
  [customerHash, staffHash] = await Promise.all([
    hashPassword(customerPassword),
    hashPassword(staffPassword),
  ]);
});

function customer(overrides: Partial<User> = {}): User {
  return {
    id: 'customer-1',
    email: 'person@example.com',
    name: 'Customer',
    passwordHash: customerHash,
    status: 'ACTIVE',
    authVersion: 2,
    mfaEnabled: false,
    mfaSecret: null,
    ...overrides,
  } as User;
}

function employee(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    email: 'person@example.com',
    name: 'Staff',
    passwordHash: staffHash,
    status: 'ACTIVE',
    authVersion: 3,
    mfaEnabled: true,
    mfaSecret: 'existing-mfa-secret',
    ...overrides,
  } as Staff;
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'customer-1',
    companyId: 'company-1',
    role: 'BUYER',
    active: true,
    termsVersion: DEALER_TERMS_VERSION,
    termsAcceptedAt: new Date(),
    company: { status: 'APPROVED', purchaseSettings: {} },
    ...overrides,
  };
}

function fixture(
  options: {
    user?: User | null;
    staff?: Staff | null;
    member?: ReturnType<typeof membership> | null;
  } = {},
) {
  const user = options.user ?? null;
  const staff = options.staff ?? null;
  const member = options.member ?? null;
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    staff: { findUnique: vi.fn().mockResolvedValue(staff) },
    dealerMember: {
      findFirst: vi.fn().mockImplementation(async ({ where }) => {
        if (
          member &&
          member.userId === where.userId &&
          member.active === where.active &&
          member.company.status === where.company.status
        )
          return member;
        return null;
      }),
    },
    authenticationSession: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    staffLoginChallenge: { create: vi.fn().mockResolvedValue({}) },
  };
  const jwt = {
    signAsync: vi.fn().mockResolvedValue('signed-session-token'),
    decode: vi
      .fn()
      .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 7200 }),
  };
  const redis = {
    incrWithTtl: vi.fn().mockResolvedValue(1),
    getNumber: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(true),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const mfa = {
    createSetup: vi.fn().mockReturnValue({
      secret: 'new-mfa-secret',
      otpauthUrl: 'otpauth://totp/test',
    }),
    verifyWithLimit: vi.fn().mockResolvedValue(true),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    audit as unknown as AuditService,
    redis as unknown as RedisService,
    {} as EmailService,
    mfa as unknown as MfaService,
  );
  return { service, prisma, jwt, redis, audit, mfa };
}

describe('Unified login identity and security boundaries', () => {
  it('normalizes the email and returns a consumer session from real credentials', async () => {
    const f = fixture({ user: customer() });
    const result = await f.service.unifiedLogin(
      {
        email: ' Person@Example.com ',
        password: customerPassword,
      },
      '127.0.0.1',
      'test browser',
    );
    expect(result).toMatchObject({
      sessionKind: 'customer',
      accessToken: 'signed-session-token',
      user: { id: 'customer-1', kind: 'customer', companyId: null },
    });
    expect(f.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'person@example.com' },
    });
    expect(f.jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'customer',
        authVersion: 2,
        companyId: null,
        mfaVerified: false,
      }),
      expect.any(Object),
    );
  });

  it('uses approved membership for dealer routing and preserves terms and MFA requirements', async () => {
    const f = fixture({
      user: customer(),
      member: membership({
        termsVersion: null,
        termsAcceptedAt: null,
        company: { status: 'APPROVED', purchaseSettings: { requireMfa: true } },
      }),
    });
    const result = await f.service.unifiedLogin({
      email: 'person@example.com',
      password: customerPassword,
    });
    expect(result).toMatchObject({
      sessionKind: 'dealer',
      user: {
        companyId: 'company-1',
        companyRole: 'BUYER',
        dealerTermsRequired: true,
        mfaRequired: true,
        mfaEnabled: false,
      },
    });
  });

  it.each([
    ['inactive member', () => membership({ active: false })],
    [
      'suspended company',
      () =>
        membership({
          company: { status: 'SUSPENDED', purchaseSettings: {} },
        }),
    ],
  ])('does not grant dealer access for %s', async (_label, createMember) => {
    const f = fixture({ user: customer(), member: createMember() });
    const result = await f.service.unifiedLogin({
      email: 'person@example.com',
      password: customerPassword,
    });
    expect(result).toMatchObject({
      sessionKind: 'customer',
      user: { companyId: null, companyRole: null },
    });
    const actor = f.jwt.signAsync.mock.calls[0][0] as JwtPayload;
    const b2b = new B2bService(
      f.prisma as unknown as PrismaService,
      {} as DealerService,
      {} as InventoryService,
    );
    await expect(b2b.listRfqs(actor)).rejects.toMatchObject({
      status: 403,
      response: { code: ERROR_CODES.FORBIDDEN },
    });
  });

  it('always challenges an enrolled staff account without issuing an authenticated token', async () => {
    const f = fixture({ staff: employee() });
    const result = await f.service.unifiedLogin({
      email: 'person@example.com',
      password: staffPassword,
      code: '123456',
    });
    expect(result).toMatchObject({
      sessionKind: 'staff',
      mfaRequired: true,
      enrollmentRequired: false,
      challengeToken: expect.any(String),
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('secret');
    expect(f.prisma.staffLoginChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ staffId: 'staff-1', authVersion: 3 }),
    });
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
    expect(f.prisma.authenticationSession.create).not.toHaveBeenCalled();
    expect(f.mfa.verifyWithLimit).not.toHaveBeenCalled();
  });

  it('requires staff MFA enrollment before any staff token can exist', async () => {
    const f = fixture({
      staff: employee({ mfaEnabled: false, mfaSecret: null }),
    });
    const result = await f.service.unifiedLogin({
      email: 'person@example.com',
      password: staffPassword,
    });
    expect(result).toMatchObject({
      sessionKind: 'staff',
      mfaRequired: true,
      enrollmentRequired: true,
      secret: 'new-mfa-secret',
      otpauthUrl: 'otpauth://totp/test',
    });
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials and shares failures with both older login endpoints', async () => {
    const f = fixture({ user: customer(), staff: employee() });
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: 'WrongPassword',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: { code: ERROR_CODES.UNAUTHORIZED },
    });
    expect(f.redis.incrWithTtl).toHaveBeenCalledWith(
      'wm:rl:login:fail:person@example.com',
      900,
    );
    expect(f.redis.incrWithTtl).toHaveBeenCalledWith(
      'wm:rl:staff:fail:person@example.com',
      900,
    );
    expect(f.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.unified.login.failed',
      }),
    );
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'SUSPENDED'] as const)(
    'preserves customer account status %s',
    async (status) => {
      const f = fixture({ user: customer({ status }) });
      await expect(
        f.service.unifiedLogin({
          email: 'person@example.com',
          password: customerPassword,
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: ERROR_CODES.FORBIDDEN },
      });
      expect(f.jwt.signAsync).not.toHaveBeenCalled();
    },
  );

  it('refuses disabled staff without an MFA challenge or session', async () => {
    const f = fixture({ staff: employee({ status: 'DISABLED' }) });
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: staffPassword,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: ERROR_CODES.FORBIDDEN },
    });
    expect(f.prisma.staffLoginChallenge.create).not.toHaveBeenCalled();
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('does not bypass an existing customer MFA enrollment', async () => {
    const f = fixture({
      user: customer({ mfaEnabled: true, mfaSecret: 'customer-secret' }),
    });
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: customerPassword,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: ERROR_CODES.MFA_REQUIRED },
    });
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('propagates rejected customer MFA without clearing lockout or creating a session', async () => {
    const f = fixture({
      user: customer({ mfaEnabled: true, mfaSecret: 'customer-secret' }),
    });
    f.mfa.verifyWithLimit.mockRejectedValue(
      new BizException(ERROR_CODES.MFA_INVALID, 'invalid MFA code', 403),
    );
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: customerPassword,
        code: '123456',
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: ERROR_CODES.MFA_INVALID },
    });
    expect(f.redis.del).not.toHaveBeenCalled();
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('issues a customer session only after the supplied MFA code is verified', async () => {
    const f = fixture({
      user: customer({ mfaEnabled: true, mfaSecret: 'customer-secret' }),
    });
    await f.service.unifiedLogin({
      email: 'person@example.com',
      password: customerPassword,
      code: '123456',
    });
    expect(f.mfa.verifyWithLimit).toHaveBeenCalledWith(
      'customer:customer-1',
      '123456',
      'customer-secret',
    );
    expect(f.jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaVerified: true,
      }),
      expect.any(Object),
    );
  });

  it.each([
    [customerPassword, 'customer'],
    [staffPassword, 'staff'],
  ])(
    'resolves same-email separate accounts by their matching password (%s)',
    async (password, kind) => {
      const f = fixture({ user: customer(), staff: employee() });
      const result = await f.service.unifiedLogin({
        email: 'person@example.com',
        password,
      });
      expect(result.sessionKind).toBe(kind);
      if (kind === 'staff') expect(result).not.toHaveProperty('accessToken');
      else expect(result).toHaveProperty('accessToken');
    },
  );

  it('rejects ambiguous identical credentials without choosing a more privileged account', async () => {
    const f = fixture({
      user: customer(),
      staff: employee({ passwordHash: customerHash }),
    });
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: customerPassword,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: ERROR_CODES.CONFLICT },
    });
    expect(f.jwt.signAsync).not.toHaveBeenCalled();
    expect(f.prisma.staffLoginChallenge.create).not.toHaveBeenCalled();
  });

  it.each(['wm:rl:login:fail:', 'wm:rl:staff:fail:'])(
    'respects the existing %s lock before reading credentials',
    async (prefix) => {
      const f = fixture({ user: customer(), staff: employee() });
      f.redis.getNumber.mockImplementation(async (key: string) =>
        key.startsWith(prefix) ? 5 : 0,
      );
      await expect(
        f.service.unifiedLogin({
          email: 'person@example.com',
          password: customerPassword,
        }),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: ERROR_CODES.RATE_LIMIT },
      });
      expect(f.prisma.user.findUnique).not.toHaveBeenCalled();
      expect(f.prisma.staff.findUnique).not.toHaveBeenCalled();
    },
  );

  it('preserves the stricter staff IP rate limit in the unified entry point', async () => {
    const f = fixture({ user: customer() });
    f.redis.incrWithTtl.mockResolvedValue(16);
    await expect(
      f.service.unifiedLogin({
        email: 'person@example.com',
        password: customerPassword,
      }),
    ).rejects.toMatchObject({
      status: 429,
      response: { code: ERROR_CODES.RATE_LIMIT },
    });
    expect(f.prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
