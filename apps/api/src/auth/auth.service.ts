import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RedisService } from '../redis/redis.service.js';
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
import { hashPassword, newOpaqueToken, normalizeEmail, sha256, verifyPassword } from './passwords.util.js';

export interface JwtPayload {
  sub: string;
  kind: 'customer' | 'staff';
  email: string;
  name: string;
  roles?: string[]; // staff 专属
  companyId?: string | null; // 经销商成员专属（企业数据边界）
  companyRole?: string | null;
  jti?: string; // 令牌唯一 id（登出黑名单）
  exp?: number; // 过期时间（s，jwt 标准声明）
}

const jwtSecret = () => process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_wemove_access';
const jwtExpiresIn = () => (process.env.JWT_ACCESS_EXPIRES_IN ?? '2h') as JwtSignOptions['expiresIn'];

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
  ) {}

  // ---------------------------------------------------------------- 注册
  async register(dto: RegisterDto, ip?: string) {
    if (!dto.ageConfirmed) {
      throw new BizException(ERROR_CODES.VALIDATION, 'adults only: registration requires 18+ confirmation');
    }
    const email = normalizeEmail(dto.email);

    // 防刷（Redis 降级时跳过，见 RedisService）
    if (await this.exceeded(`wm:rl:register:ip:${ip ?? 'anon'}`, RL.registerIp)) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many registrations, slow down', 429);
    }
    if (await this.exceeded(`wm:rl:register:${email}`, RL.registerEmail)) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many registrations for this email', 429);
    }

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BizException(ERROR_CODES.CONFLICT, 'email already registered', 409);
    }

    const passwordHash = await hashPassword(dto.password);
    const emailVerifyRequired = process.env.EMAIL_VERIFY_REQUIRED === 'true';

    // 合规：交易面向成年人；EMAIL_VERIFY_REQUIRED=true 时走"验证后 ACTIVE"
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        ageConfirmed: true,
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
    const record = await this.prisma.userToken.findFirst({
      where: { type: 'EMAIL_VERIFY', tokenHash, consumedAt: null },
    });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BizException(ERROR_CODES.VALIDATION, 'verification link invalid or expired', 400);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId ?? '' },
        data: { status: 'ACTIVE' },
      }),
      this.prisma.userToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    ]);

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: record.userId,
      action: 'auth.email.verify',
      entityType: 'user',
      entityId: record.userId,
    });
    return { verified: true, email: record.email };
  }

  /** 重发验证邮件：统一返回成功形状（防邮箱枚举） */
  async resendVerification(dto: ResendVerificationDto) {
    const email = normalizeEmail(dto.email);
    if (await this.exceeded(`wm:rl:resend:${email}`, RL.resendEmail)) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many emails, try later', 429);
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === 'PENDING') {
      // 作废旧验证码再发新的，避免堆积
      await this.prisma.userToken.updateMany({
        where: { type: 'EMAIL_VERIFY', email, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const token = await this.issueToken('EMAIL_VERIFY', email, user.id, 24);
      await this.email.sendVerification(email, token);
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- 登录（C 端/经销商）
  async login(dto: LoginDto, ip?: string) {
    const email = normalizeEmail(dto.email);
    const failureKey = `wm:rl:login:fail:${email}`;

    if (await this.exceeded(`wm:rl:login:ip:${ip ?? 'anon'}`, RL.loginIp)) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many attempts, slow down', 429);
    }
    await this.assertNotLocked(failureKey, RL.loginFailEmail);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      // 失败计数：第 max 次起锁定
      await this.countFailure(failureKey, RL.loginFailEmail);
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'invalid email or password', 401);
    }
    if (user.status === 'PENDING') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'email not verified yet', 403);
    }
    if (user.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account suspended', 403);
    }

    await this.redis.del(failureKey); // 成功后清零
    const company = await this.companyBoundaryOf(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      kind: 'customer',
      email: user.email,
      name: user.name,
      companyId: company?.companyId ?? null,
      companyRole: company?.role ?? null,
      jti: randomUUID(),
    };
    return this.issueAuthResult(payload);
  }

  /** 经销商企业边界解析：仅取已通过审核的企业（安全底线：公司隔离） */
  private async companyBoundaryOf(userId: string) {
    return this.prisma.dealerMember.findFirst({
      where: { userId, company: { status: 'APPROVED' } },
      select: { companyId: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------- 员工登录（Admin）
  async staffLogin(dto: StaffLoginDto, ip?: string) {
    const email = normalizeEmail(dto.email);
    const failureKey = `wm:rl:staff:fail:${email}`;

    if (await this.exceeded(`wm:rl:staff:ip:${ip ?? 'anon'}`, RL.staffLoginIp)) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many attempts, slow down', 429);
    }
    await this.assertNotLocked(failureKey, RL.staffLoginFailEmail);

    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!staff || !(await verifyPassword(dto.password, staff.passwordHash))) {
      await this.countFailure(failureKey, RL.staffLoginFailEmail);
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'invalid email or password', 401);
    }
    if (staff.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account disabled', 403);
    }

  await this.redis.del(failureKey);
    const roles = staff.roles.map((r: any) => r.role.code);
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.login',
      entityType: 'staff',
      entityId: staff.id,
      ip,
    });

    return this.issueAuthResult({
      sub: staff.id,
      kind: 'staff',
      email: staff.email,
      name: staff.name,
      roles,
      jti: randomUUID(),
    });
  }

  // ---------------------------------------------------------------- 忘记/重置密码
  /** 统一返回 ok:true（防邮箱枚举）；仅对存在且未停用的账号发信 */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    if (await this.exceeded(`wm:rl:forgot:${email}`, { max: 3, windowSec: 600 })) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many requests, try later', 429);
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
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BizException(ERROR_CODES.VALIDATION, 'reset link invalid or expired', 400);
    }
    const user = await this.prisma.user.findUnique({ where: { email: record.email } });
    if (!user || user.status === 'SUSPENDED') {
      throw new BizException(ERROR_CODES.VALIDATION, 'reset link invalid or expired', 400);
    }

    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // 同邮箱全部重置令牌一次性作废（含本次）
      this.prisma.userToken.updateMany({
        where: { type: 'PASSWORD_RESET', email: user.email, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
    ]);

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: user.id,
      action: 'auth.password.reset',
      entityType: 'user',
      entityId: user.id,
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- 登出（JWT 黑名单）
  async logout(payload: JwtPayload) {
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
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('user account not found');
    return {
      id: user.id,
      kind: 'customer',
      email: user.email,
      name: user.name,
      companyId: payload.companyId ?? null,
      companyRole: payload.companyRole ?? null,
    };
  }

  // ---------------------------------------------------------------- 内部工具
  /** 限流计数是否超限（Redis 不可用返回 false=放行） */
  private async exceeded(key: string, limit: { max: number; windowSec: number }): Promise<boolean> {
    const count = await this.redis.incrWithTtl(key, limit.windowSec);
    return count !== null && count > limit.max;
  }

  /** 失败计数：超出后抛 429（防止继续试探密码） */
  private async countFailure(key: string, limit: { max: number; windowSec: number }) {
    const count = await this.redis.incrWithTtl(key, limit.windowSec);
    if (count !== null && count >= limit.max) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many failed attempts, try again later', 429);
    }
  }

  /** 锁定窗口内即使密码正确也不放行，避免失败计数被绕过。 */
  private async assertNotLocked(key: string, limit: { max: number; windowSec: number }) {
    const count = await this.redis.getNumber(key);
    if (count !== null && count >= limit.max) {
      throw new BizException(ERROR_CODES.RATE_LIMIT, 'too many failed attempts, try again later', 429);
    }
  }

  private async issueToken(
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
    email: string,
    userId: string | null,
    hours: number,
  ) {
    const { token, tokenHash } = newOpaqueToken();
    await this.prisma.userToken.create({
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

  private async issueAuthResult(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: jwtSecret(),
      expiresIn: jwtExpiresIn(),
    });
    return {
      accessToken,
      expiresIn: jwtExpiresIn(),
      tokenType: 'Bearer',
      user: await this.me(payload),
    };
  }
}
