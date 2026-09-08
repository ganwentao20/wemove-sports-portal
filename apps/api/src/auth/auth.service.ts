import { acceptedDealerTerms } from '../account/dealer-terms.js';
import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Prisma, Staff, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RedisService } from '../redis/redis.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { EmailService } from '../email/email.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  ResendVerificationDto,
  StaffLoginDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';
import {
  hashPassword,
  newOpaqueToken,
  normalizeEmail,
  sha256,
  verifyPassword,
} from './passwords.util.js';

export interface JwtPayload {
  sub: string;
  kind: 'customer' | 'staff';
  email: string;
  name: string;
  permissions?: string[];
  authVersion?: number;
  mfaVerified?: boolean;
  roles?: string[]; // staff 专属
  companyId?: string | null; // 经销商成员专属（企业数据边界）
  companyRole?: string | null;
  jti?: string; // 令牌唯一 id（登出黑名单）
  exp?: number; // 过期时间（s，jwt 标准声明）
}

const jwtSecret = () =>
  process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_wemove_access';
const jwtExpiresIn = () =>
  (process.env.JWT_ACCESS_EXPIRES_IN ?? '2h') as JwtSignOptions['expiresIn'];

/** 限流参数（Redis 降级时自动跳过；窗口均从首次计数起算） */
const RL = {
  loginFailEmail: { max: 5, windowSec: 900 }, // 单邮箱连续失败 5 次锁 15 分钟
  loginIp: { max: 30, windowSec: 60 }, // 单 IP 每分钟登录尝试
  staffLoginFailEmail: { max: 5, windowSec: 900 },
  staffLoginIp: { max: 15, windowSec: 60 },
  registerIp: { max: 20, windowSec: 60 },
  registerEmail: { max: 5, windowSec: 600 },
  resendEmail: { max: 3, windowSec: 600 },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly mfa: MfaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- 注册
  async register(dto: RegisterDto, ip?: string) {
    if (!dto.ageConfirmed) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'adults only: registration requires 18+ confirmation',
      );
    }
    if (!dto.termsAccepted)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'You must agree to the terms and privacy policy',
        400,
      );
    const email = normalizeEmail(dto.email);

    // 防刷（Redis 降级时跳过，见 RedisService）
    if (
      await this.exceeded(`wm:rl:register:ip:${ip ?? 'anon'}`, RL.registerIp)
    ) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many registrations, slow down',
        429,
      );
    }
    if (await this.exceeded(`wm:rl:register:${email}`, RL.registerEmail)) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many registrations for this email',
        429,
      );
    }

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'email already registered',
        409,
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const emailVerifyRequired =
      process.env.NODE_ENV === 'production' ||
      process.env.EMAIL_VERIFY_REQUIRED !== 'false';

    // 合规：交易面向成年人；EMAIL_VERIFY_REQUIRED=true 时走"验证后 ACTIVE"
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        ageConfirmed: true,
        termsVersion: 'terms-2026-09',
        privacyVersion: 'privacy-2026-09',
        policiesAgreedAt: new Date(),
        policiesIp: ip,
        marketingEmail: dto.marketingEmail ?? false,
        productUpdates: dto.productUpdates ?? false,
        status: emailVerifyRequired ? 'PENDING' : 'ACTIVE',
      },
    });

    if (emailVerifyRequired) {
      const token = await this.issueToken('EMAIL_VERIFY', email, user.id, 24);
      await this.email.sendVerification(email, token); // SMTP 未配置时自动日志模式
    }

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      after: { email },
      ip,
    });

    return { id: user.id, email: user.email, status: user.status };
  }

  // ---------------------------------------------------------------- 邮箱验证
  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = sha256(dto.token.trim());
    const user = await this.prisma.$transaction(async (tx) => {
      const { user } = await this.lockUserToken(tx, 'EMAIL_VERIFY', tokenHash);
      if (user.status !== 'PENDING') this.invalidToken('EMAIL_VERIFY');
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      await tx.userToken.updateMany({
        where: { type: 'EMAIL_VERIFY', userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return user;
    });

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: user.id,
      action: 'auth.email.verify',
      entityType: 'user',
      entityId: user.id,
    });
    await this.notifications?.enqueue({
      kind: 'account.welcome',
      to: user.email,
      subject: 'Welcome to WEMOVE',
      text: 'Your email is verified. You can now sign in and manage your account.',
      dedupeKey: `account-welcome:${user.id}`,
    });
    return { verified: true, email: user.email };
  }

  /** 重发验证邮件：统一返回成功形状（防邮箱枚举） */
  async resendVerification(dto: ResendVerificationDto) {
    const email = normalizeEmail(dto.email);
    if (await this.exceeded(`wm:rl:resend:${email}`, RL.resendEmail)) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many emails, try later',
        429,
      );
    }
    const token = await this.prisma.$transaction(async (tx) => {
      // Resend and verification share the account lock: replacement is atomic.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "email" = ${email} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { email } });
      if (!user || user.status !== 'PENDING') return null;
      await tx.userToken.updateMany({
        where: { type: 'EMAIL_VERIFY', email, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return this.issueToken('EMAIL_VERIFY', email, user.id, 24, tx);
    });
    if (token) await this.email.sendVerification(email, token);
    return { ok: true };
  }

  // ---------------------------------------------------------------- 统一登录入口
  async unifiedLogin(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = normalizeEmail(dto.email);
    const customerFailureKey = `wm:rl:login:fail:${email}`;
    const staffFailureKey = `wm:rl:staff:fail:${email}`;

    // Share the existing counters: switching entry points cannot bypass a lock.
    const customerIpLimited = await this.exceeded(
      `wm:rl:login:ip:${ip ?? 'anon'}`,
      RL.loginIp,
    );
    const staffIpLimited = await this.exceeded(
      `wm:rl:staff:ip:${ip ?? 'anon'}`,
      RL.staffLoginIp,
    );
    if (customerIpLimited || staffIpLimited)
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many attempts, slow down',
        429,
      );
    await this.assertNotLocked(customerFailureKey, RL.loginFailEmail);
    await this.assertNotLocked(staffFailureKey, RL.staffLoginFailEmail);

    const [user, staff] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.staff.findUnique({ where: { email } }),
    ]);
    const [customerMatches, staffMatches] = await Promise.all([
      user ? verifyPassword(dto.password, user.passwordHash) : false,
      staff ? verifyPassword(dto.password, staff.passwordHash) : false,
    ]);
    if (customerMatches && staffMatches)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'These credentials match both a customer and a staff account. Contact an administrator to assign different email addresses or passwords.',
        409,
      );
    if (staff && staffMatches) {
      return {
        ...(await this.beginStaffLogin(staff, staffFailureKey)),
        sessionKind: 'staff' as const,
      };
    }
    if (user && customerMatches) {
      const result = await this.completeCustomerLogin(
        user,
        dto,
        customerFailureKey,
        ip,
        userAgent,
      );
      return {
        ...result,
        sessionKind: 'companyId' in result.user && result.user.companyId
          ? ('dealer' as const)
          : ('customer' as const),
      };
    }

    await this.audit.record({
      actorKind: 'ANON',
      action: 'auth.unified.login.failed',
      after: { email },
      ip,
    });
    // Increment both scopes before throwing so the fifth failure locks both.
    const failures = await Promise.allSettled([
      this.countFailure(customerFailureKey, RL.loginFailEmail),
      this.countFailure(staffFailureKey, RL.staffLoginFailEmail),
    ]);
    for (const failure of failures)
      if (failure.status === 'rejected') throw failure.reason;
    throw new BizException(
      ERROR_CODES.UNAUTHORIZED,
      'invalid email or password',
      401,
    );
  }

  // ---------------------------------------------------------------- 登录（C 端/经销商）
  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = normalizeEmail(dto.email);
    const failureKey = `wm:rl:login:fail:${email}`;

    if (await this.exceeded(`wm:rl:login:ip:${ip ?? 'anon'}`, RL.loginIp)) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many attempts, slow down',
        429,
      );
    }
    await this.assertNotLocked(failureKey, RL.loginFailEmail);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      // 失败计数：第 max 次起锁定
      await this.audit.record({
        actorKind: 'ANON',
        action: 'auth.login.failed',
        after: { email },
        ip,
      });
      await this.countFailure(failureKey, RL.loginFailEmail);
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'invalid email or password',
        401,
      );
    }
    return this.completeCustomerLogin(user, dto, failureKey, ip, userAgent);
  }

  private async completeCustomerLogin(
    user: User,
    dto: LoginDto,
    failureKey: string,
    ip?: string,
    userAgent?: string,
  ) {
    if (user.status === 'PENDING') {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'email not verified yet',
        403,
      );
    }
    if (user.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account suspended', 403);
    }

    if (user.mfaEnabled) {
      if (!user.mfaSecret || !dto.code)
        throw new BizException(
          ERROR_CODES.MFA_REQUIRED,
          'Authenticator code required',
          403,
        );
      await this.mfa.verifyWithLimit(
        `customer:${user.id}`,
        dto.code,
        user.mfaSecret,
      );
    }
    await this.redis.del(failureKey); // 成功后清零
    const company = await this.companyBoundaryOf(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      kind: 'customer',
      email: user.email,
      name: user.name,
      authVersion: user.authVersion,
      mfaVerified: user.mfaEnabled,
      companyId: company?.companyId ?? null,
      companyRole: company?.role ?? null,
      jti: randomUUID(),
    };
    return this.issueAuthResult(payload, ip, userAgent);
  }

  /** 经销商企业边界解析：仅取已通过审核的企业（安全底线：公司隔离） */
  private async companyBoundaryOf(userId: string) {
    return this.prisma.dealerMember.findFirst({
      where: { userId, active: true, company: { status: 'APPROVED' } },
      select: {
        companyId: true,
        role: true,
        termsVersion: true,
        termsAcceptedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async companyRequiresMfa(userId: string) {
    const member = await this.prisma.dealerMember.findFirst({
      where: { userId, active: true, company: { status: 'APPROVED' } },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });
    return !!(
      member?.company.purchaseSettings as { requireMfa?: boolean } | undefined
    )?.requireMfa;
  }

  // ---------------------------------------------------------------- 员工登录（Admin）
  async staffLogin(dto: StaffLoginDto, ip?: string) {
    const email = normalizeEmail(dto.email);
    const failureKey = `wm:rl:staff:fail:${email}`;

    if (
      await this.exceeded(`wm:rl:staff:ip:${ip ?? 'anon'}`, RL.staffLoginIp)
    ) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many attempts, slow down',
        429,
      );
    }
    await this.assertNotLocked(failureKey, RL.staffLoginFailEmail);

    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!staff || !(await verifyPassword(dto.password, staff.passwordHash))) {
      await this.audit.record({
        actorKind: 'ANON',
        action: 'staff.login.failed',
        after: { email },
        ip,
      });
      await this.countFailure(failureKey, RL.staffLoginFailEmail);
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'invalid email or password',
        401,
      );
    }
    return this.beginStaffLogin(staff, failureKey);
  }

  private async beginStaffLogin(staff: Staff, failureKey: string) {
    if (staff.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account disabled', 403);
    }

    await this.redis.del(failureKey);
    const setup = staff.mfaEnabled ? null : this.mfa.createSetup(staff.email);
    const { token, tokenHash } = newOpaqueToken();
    await this.prisma.staffLoginChallenge.create({
      data: {
        tokenHash,
        staffId: staff.id,
        authVersion: staff.authVersion,
        setupSecret: setup?.secret,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    return {
      mfaRequired: true,
      enrollmentRequired: !staff.mfaEnabled,
      challengeToken: token,
      ...(setup ? { secret: setup.secret, otpauthUrl: setup.otpauthUrl } : {}),
    };
  }

  async staffMfaLogin(
    dto: { challengeToken: string; code: string },
    ip?: string,
    userAgent?: string,
  ) {
    const hash = sha256(dto.challengeToken);
    const challenge = await this.prisma.staffLoginChallenge.findUnique({
      where: { tokenHash: hash },
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.attempts >= 5
    )
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'MFA challenge expired; sign in again',
        401,
      );
    const attempt = await this.prisma.staffLoginChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: 5 }, consumedAt: null },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count !== 1)
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'MFA challenge locked',
        429,
      );
    const staff = await this.prisma.staff.findUnique({
      where: { id: challenge.staffId },
    });
    if (
      !staff ||
      staff.status !== 'ACTIVE' ||
      staff.authVersion !== challenge.authVersion
    )
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'staff access revoked',
        401,
      );
    const secret = staff.mfaEnabled ? staff.mfaSecret : challenge.setupSecret;
    if (!secret)
      throw new BizException(
        ERROR_CODES.MFA_REQUIRED,
        'enrollment required',
        403,
      );
    await this.mfa.verifyWithLimit(staff.id, dto.code, secret);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "id" = ${staff.id} FOR UPDATE`;
      const current = await tx.staff.findUniqueOrThrow({
        where: { id: staff.id },
      });
      if (
        current.status !== 'ACTIVE' ||
        current.authVersion !== challenge.authVersion ||
        (!staff.mfaEnabled && current.mfaEnabled)
      )
        throw new BizException(
          ERROR_CODES.UNAUTHORIZED,
          'staff access changed; sign in again',
          401,
        );
      const consumed = await tx.staffLoginChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new BizException(
          ERROR_CODES.UNAUTHORIZED,
          'MFA challenge already used',
          401,
        );
      if (!current.mfaEnabled)
        await tx.staff.update({
          where: { id: staff.id },
          data: {
            mfaEnabled: true,
            mfaSecret: secret,
            mfaConfirmedAt: new Date(),
          },
        });
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.login.mfa',
      entityType: 'staff',
      entityId: staff.id,
      ip,
    });
    return this.issueAuthResult(
      {
        sub: staff.id,
        kind: 'staff',
        email: staff.email,
        name: staff.name,
        authVersion: staff.authVersion,
        mfaVerified: true,
        jti: randomUUID(),
      },
      ip,
      userAgent,
    );
  }

  // ---------------------------------------------------------------- 忘记/重置密码
  /** 统一返回 ok:true（防邮箱枚举）；仅对存在且未停用的账号发信 */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    if (
      await this.exceeded(`wm:rl:forgot:${email}`, { max: 3, windowSec: 600 })
    ) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many requests, try later',
        429,
      );
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status !== 'SUSPENDED') {
      const token = await this.issueToken('PASSWORD_RESET', email, user.id, 1);
      await this.email.sendPasswordReset(email, token);
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = sha256(dto.token.trim());
    const record = await this.prisma.userToken.findFirst({
      where: { type: 'PASSWORD_RESET', tokenHash, consumedAt: null },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'reset link invalid or expired',
        400,
      );
    }
    // Hash outside the transaction, then recheck the token under the account lock.
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const { user } = await this.lockUserToken(
        tx,
        'PASSWORD_RESET',
        tokenHash,
      );
      if (user.status === 'SUSPENDED') this.invalidToken('PASSWORD_RESET');
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      // 同邮箱全部重置令牌一次性作废（含本次）
      await tx.userToken.updateMany({
        where: { type: 'PASSWORD_RESET', userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return user;
    });

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: user.id,
      action: 'auth.password.reset',
      entityType: 'user',
      entityId: user.id,
    });
    await this.notifications?.enqueue({
      kind: 'account.password-changed',
      to: user.email,
      subject: 'Your WEMOVE password changed',
      text: 'Your password was reset and all previous sessions were revoked. Contact support immediately if you did not request this.',
      dedupeKey: `password-reset:${tokenHash}`,
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- 登出（JWT 黑名单）
  async logout(payload: JwtPayload) {
    if (payload.jti)
      await this.prisma.authenticationSession.updateMany({
        where: {
          id: payload.jti,
          ownerId: payload.sub,
          ownerKind: payload.kind,
        },
        data: { revokedAt: new Date() },
      });
    if (payload.jti && payload.exp) {
      const ttlMs = payload.exp * 1000 - Date.now();
      if (ttlMs > 0) {
        // Redis 不可用时尽力而为（返回 false）：客户端照常丢弃 token，属安全降级（见 README 说明）
        await this.redis.setEx(`wm:jti:${payload.jti}`, '1', ttlMs);
      }
    }
    void this.audit.record({
      actorKind: payload.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
      actorCustomerId: payload.kind === 'customer' ? payload.sub : null,
      actorStaffId: payload.kind === 'staff' ? payload.sub : null,
      action: 'auth.logout',
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- 当前用户
  async me(payload: JwtPayload) {
    if (payload.kind === 'staff') {
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: true } } },
      });
      if (!staff) throw new UnauthorizedException('staff account not found');
      return {
        id: staff.id,
        kind: 'staff',
        email: staff.email,
        name: staff.name,
        roles: staff.roles.map((r: any) => r.role.code),
        permissions: payload.permissions ?? [],
        mfaEnabled: staff.mfaEnabled,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('user account not found');
    const member = await this.companyBoundaryOf(user.id);
    return {
      id: user.id,
      kind: 'customer',
      email: user.email,
      name: user.name,
      companyId: payload.companyId ?? null,
      companyRole: payload.companyRole ?? null,
      mfaEnabled: user.mfaEnabled,
      mfaRequired: await this.companyRequiresMfa(user.id),
      dealerTermsRequired: Boolean(member && !acceptedDealerTerms(member)),
    };
  }

  // ---------------------------------------------------------------- 内部工具
  private invalidToken(type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): never {
    throw new BizException(
      ERROR_CODES.VALIDATION,
      `${type === 'EMAIL_VERIFY' ? 'verification' : 'reset'} link invalid or expired`,
      400,
    );
  }

  private async lockUserToken(
    tx: Prisma.TransactionClient,
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
    tokenHash: string,
  ) {
    const candidate = await tx.userToken.findFirst({
      where: { type, tokenHash },
    });
    if (!candidate?.userId) this.invalidToken(type);
    // Lock the account, not just one token: multiple reset links must serialize too.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId} FOR UPDATE`;
    const record = await tx.userToken.findFirst({
      where: {
        id: candidate.id,
        type,
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const user = await tx.user.findUnique({ where: { id: candidate.userId } });
    if (!record || !user || record.email !== user.email)
      this.invalidToken(type);
    return { record, user };
  }

  /** 限流计数是否超限（Redis 不可用返回 false=放行） */
  private async exceeded(
    key: string,
    limit: { max: number; windowSec: number },
  ): Promise<boolean> {
    const count = await this.redis.incrWithTtl(key, limit.windowSec);
    if (count === null && process.env.NODE_ENV === 'production')
      throw new BizException(
        ERROR_CODES.INTERNAL,
        'Authentication rate limiter unavailable; try again shortly',
        503,
      );
    return count !== null && count > limit.max;
  }

  /** 失败计数：超出后抛 429（防止继续试探密码） */
  private async countFailure(
    key: string,
    limit: { max: number; windowSec: number },
  ) {
    const count = await this.redis.incrWithTtl(key, limit.windowSec);
    if (count !== null && count >= limit.max) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many failed attempts, try again later',
        429,
      );
    }
  }

  /** 锁定窗口内即使密码正确也不放行，避免失败计数被绕过。 */
  private async assertNotLocked(
    key: string,
    limit: { max: number; windowSec: number },
  ) {
    const count = await this.redis.getNumber(key);
    if (count !== null && count >= limit.max) {
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'too many failed attempts, try again later',
        429,
      );
    }
  }

  private async issueToken(
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
    email: string,
    userId: string | null,
    hours: number,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const { token, tokenHash } = newOpaqueToken();
    await db.userToken.create({
      data: {
        type,
        tokenHash,
        email,
        userId,
        expiresAt: new Date(Date.now() + hours * 3600_000),
      },
    });
    return token;
  }

  private async issueAuthResult(
    payload: JwtPayload,
    ip?: string,
    userAgent?: string,
  ) {
    const previous = await this.prisma.authenticationSession.findFirst({
      where: { ownerId: payload.sub, ownerKind: payload.kind },
      orderBy: { createdAt: 'desc' },
    });
    const accessToken = await this.jwt.signAsync(payload, {
      secret: jwtSecret(),
      expiresIn: jwtExpiresIn(),
    });
    const decoded = this.jwt.decode(accessToken) as { exp: number };
    await this.prisma.authenticationSession.create({
      data: {
        id: payload.jti!,
        ownerId: payload.sub,
        ownerKind: payload.kind,
        authVersion: payload.authVersion ?? 0,
        mfaVerified: payload.mfaVerified ?? false,
        ip,
        userAgent: userAgent?.slice(0, 500),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
    await this.audit.record({
      actorKind: payload.kind === 'staff' ? 'STAFF' : 'CUSTOMER',
      actorStaffId: payload.kind === 'staff' ? payload.sub : null,
      actorCustomerId: payload.kind === 'customer' ? payload.sub : null,
      action: 'auth.session.created',
      entityType: 'session',
      entityId: payload.jti,
      ip,
      userAgent: userAgent?.slice(0, 500),
    });
    if (
      previous &&
      (previous.ip !== (ip ?? null) ||
        previous.userAgent !== (userAgent?.slice(0, 500) ?? null))
    ) {
      await this.notifications?.enqueue({
        kind: 'security.new_device',
        to: payload.email,
        subject: 'New sign-in to your WEMOVE account',
        text: `A sign-in from a new device or network was recorded at ${new Date().toISOString()}. If this was not you, change your password and revoke sessions from account security.`,
        dedupeKey: `account:${payload.sub}:new-device:${payload.jti}`,
      });
    }
    return {
      accessToken,
      expiresIn: jwtExpiresIn(),
      tokenType: 'Bearer',
      user: await this.me(payload),
    };
  }
}
