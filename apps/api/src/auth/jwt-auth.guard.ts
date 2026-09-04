import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { JwtPayload } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT 守卫：Bearer Token → 校验签名 → req.user=payload
 * 双体系共用（payload.kind: customer | staff），角色控制见 rbac/roles.guard.ts
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new BizException(ERROR_CODES.UNAUTHORIZED, 'missing bearer token', 401);
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_wemove_access',
      });
      req.user = payload;
      return true;
    } catch {
      throw new BizException(ERROR_CODES.TOKEN_EXPIRED, 'token expired or invalid', 401);
    }
  }
}
