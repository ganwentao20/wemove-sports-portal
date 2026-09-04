import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { RegisterDto, LoginDto, StaffLoginDto } from './dto/auth.dto.js';
import { hashPassword, newOpaqueToken, normalizeEmail, verifyPassword } from './passwords.util.js';

export interface JwtPayload {
  sub: string;
  kind: 'customer' | 'staff';
  email: string;
  name: string;
  roles?: string[]; // staff 专属
  companyId?: string | null; // 经销商成员专属（企业数据边界）
  companyRole?: string | null;
}

const jwtSecret = () => process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_wemove_access';
const jwtExpiresIn = () => (process.env.JWT_ACCESS_EXPIRES_IN ?? '2h') as JwtSignOptions['expiresIn'];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 注册
  async register(dto: RegisterDto) {
    if (!dto.ageConfirmed) {
      throw new BizException(ERROR_CODES.VALIDATION, 'adults only: registration requires 18+ confirmation');
    }
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BizException(ERROR_CODES.CONFLICT, 'email already registered', 409);
    }

    const passwordHash = await hashPassword(dto.password);
    const emailVerifyRequired = process.env.EMAIL_VERIFY_REQUIRED === 'true';

    // 合规：交易面向成年人；未开启邮箱验证时直接 ACTIVE（开发期），开启后走 Token 流程
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
      // TODO(组员A/组长): 邮件发送服务接入后发真实验证邮件；当前仅生成令牌
      await this.issueToken('EMAIL_VERIFY', email, user.id, 24);
    }

    void this.audit.record({
      actorKind: 'CUSTOMER',
      actorCustomerId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      after: { email },
    });

    return { id: user.id, email: user.email, status: user.status };
  }

  // ---------------------------------------------------------------- 登录
  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'invalid email or password', 401);
    }
    if (user.status === 'PENDING') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'email not verified yet', 403);
    }
    if (user.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account suspended', 403);
    }

    const company = await this.companyBoundaryOf(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      kind: 'customer',
      email: user.email,
      name: user.name,
      companyId: company?.companyId ?? null,
      companyRole: company?.role ?? null,
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
  async staffLogin(dto: StaffLoginDto) {
    const email = normalizeEmail(dto.email);
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!staff || !(await verifyPassword(dto.password, staff.passwordHash))) {
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'invalid email or password', 401);
    }
    if (staff.status !== 'ACTIVE') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'account disabled', 403);
    }

    const roles = staff.roles.map((r) => r.role.code);
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.login',
      entityType: 'staff',
      entityId: staff.id,
    });

    return this.issueAuthResult({
      sub: staff.id,
      kind: 'staff',
      email: staff.email,
      name: staff.name,
      roles,
    });
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
        roles: staff.roles.map((r) => r.role.code),
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
    console.log(`[auth] ${type} dev-token for ${email}: ${token}`); // TODO: 邮件服务替换
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
