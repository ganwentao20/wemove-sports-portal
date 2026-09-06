import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MfaService } from './mfa.service.js';
import type { JwtPayload } from '../auth/auth.service.js';

export const MFA_KEY = 'wm_require_mfa';

/** @RequireMfa() —— 敏感写操作二次认证标记（与 JwtAuthGuard、RolesGuard 同用） */
export const RequireMfa = () => SetMetadata(MFA_KEY, true);

interface GuardRequest extends Request {
  user?: JwtPayload;
}

/**
 * MFA 守卫：带 @RequireMfa 的路由必须满足
 * 1) 登录者为 staff；2) 已启用 MFA；3) 请求头 x-mfa-code 提供当前 6 位动态码且校验通过。
 * 校验失败（连续 5 次）触发 15 分钟锁定（见 MfaService）。
 */
@Injectable()
export class RequireMfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly mfa: MfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest<GuardRequest>().user;
    if (!user || user.kind !== 'staff') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'admin area only', 403);
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: user.sub },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!staff) {
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'staff account not found', 401);
    }
    if (!staff.mfaEnabled || !staff.mfaSecret) {
      throw new BizException(
        ERROR_CODES.MFA_REQUIRED,
        'MFA not enabled: enroll via POST /admin/me/mfa/setup first',
        403,
      );
    }

    const req = context.switchToHttp().getRequest<GuardRequest>();
    const code = req.headers['x-mfa-code'];
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new BizException(
        ERROR_CODES.MFA_REQUIRED,
        'MFA code required: send header x-mfa-code with a 6-digit code',
        403,
      );
    }

    await this.mfa.verifyWithLimit(user.sub, code, staff.mfaSecret); // 失败即抛
    return true;
  }
}
