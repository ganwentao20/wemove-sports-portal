import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { JwtPayload } from '../auth/auth.service.js';

export const ROLES_KEY = 'wm_roles';

/** @Roles('SUPER_ADMIN', 'CATALOG_OPERATOR') —— 仅限后台员工角色（kind==='staff'） */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

interface GuardRequest extends Request {
  user?: JwtPayload;
}

/**
 * RBAC 角色守卫：校验 staff 角色是否命中 @Roles 声明的集合。
 * 用法：@UseGuards(JwtAuthGuard, RolesGuard) + @Roles('SUPER_ADMIN')
 * 更细粒度权限点（PermissionCode）在 Service 层内做，见各模块规范。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<GuardRequest>().user;
    if (!user || user.kind !== 'staff') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'admin area only', 403);
    }
    const owned = new Set(user.roles ?? []);
    if (!required.some((r) => owned.has(r))) {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'insufficient permissions', 403);
    }
    return true;
  }
}
