import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { RedisService } from '../redis/redis.service.js';
import type { JwtPayload } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT 守卫：Bearer Token → 校验签名 → 校验登出黑名单 → req.user=payload
 * - 双体系共用（payload.kind: customer | staff），角色控制见 rbac/roles.guard.ts
 * - 黑名单查询失败（Redis 不可用）时放行并依赖服务端其余防护（安全降级说明见 README）
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

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

      if (payload.jti) {
        const revoked = await this.redis.exists(`wm:jti:${payload.jti}`);
        if (revoked) {
          throw new BizException(ERROR_CODES.TOKEN_EXPIRED, 'token revoked (logged out)', 401);
        }
      }

      req.user = payload;
      return true;
    } catch (err) {
      if (err instanceof BizException) throw err;
      throw new BizException(ERROR_CODES.TOKEN_EXPIRED, 'token expired or invalid', 401);
    }
  }
}

/**
 * 可选登录守卫：携带有效 Bearer 时注入 req.user；未登录/无效令牌一律放行。
 * 用于"游客可提交、登录则绑定归属"的接口（如经销商资质申请）。
 * 注意：仅作归属绑定增强，绝不可用它替代需要强制登录的鉴权。
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // 匿名/无效令牌：放行（user 保持 undefined）
    }
    return true;
  }
}
