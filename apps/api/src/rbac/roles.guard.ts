import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { JwtPayload } from '../auth/auth.service.js';
export const ROLES_KEY = 'wm_roles';
export const PERMISSIONS_KEY = 'wm_permissions';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export function permissionsForRequest(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): string[] {
  const read = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const action = read ? 'read' : 'write';
  if (/\/(?:admin\/)?dashboard(?:\/|$)/.test(path)) return ['reports:read'];
  if (/\/(?:admin\/)?seo(?:\/|$)/.test(path))
    return [`cms:${action}`, 'cms:page:write'];
  if (/\/(?:admin\/)?cms(?:\/|$)/.test(path))
    return [`cms:${action}`, 'cms:page:write'];
  if (/\/(?:admin\/)?contacts?(?:\/|$)/.test(path))
    return [`contact:${action}`, 'cms:contact:manage'];
  if (/\/admin\/staff(?:\/|$)/.test(path)) return [`system:staff:${action}`];
  if (/\/admin\/(roles|permissions)(?:\/|$)/.test(path))
    return ['system:rbac:write'];
  if (/\/admin\/audit(?:\/|$)/.test(path)) return ['system:audit:read'];
  if (/\/admin\/users(?:\/|$)/.test(path)) return [`user:${action}`];
  if (/\/admin\/(reports|dashboard)(?:\/|$)/.test(path))
    return ['reports:read'];
  if (/\/admin\/(settings|seo|redirects|platform)(?:\/|$)/.test(path))
    return ['system:settings:write'];
  if (/\/admin\/(pricing|pricing-rules|prices|price-books)(?:\/|$)/.test(path))
    return ['catalog:price:write'];
  if (
    /\/admin\/(catalog|products|categories|variants|stock|inventory)(?:\/|$)/.test(
      path,
    )
  ) {
    let operation = read
      ? 'read'
      : method === 'POST'
        ? 'create'
        : method === 'DELETE'
          ? 'archive'
          : 'edit';
    if (path.endsWith('/export')) operation = 'export';
    else if (path.endsWith('/import')) operation = 'import';
    else if (
      body?.status === 'ACTIVE' ||
      body?.status === 'SCHEDULED' ||
      body?.publishAt
    )
      operation = 'publish';
    else if (body?.status === 'ARCHIVED') operation = 'archive';
    return [
      `catalog:product:${operation}`,
      ...(operation === 'read' ? [] : ['catalog:product:write']),
    ];
  }
  if (
    /\/admin\/(orders|payments|returns|shipments|commerce)(?:\/|$)/.test(path)
  )
    return [`order:${action}`];
  if (/\/admin\/(dealer|dealers|b2b)(?:\/|$)/.test(path))
    return [`b2b:${action}`, read ? 'b2b:dealer:read' : 'b2b:dealer:review'];
  if (/\/admin\/cms(?:\/|$)/.test(path))
    return [`cms:${action}`, 'cms:page:write'];
  if (/\/(?:admin\/)?media(?:\/|$)/.test(path))
    return [`media:${action}`, 'cms:media:write'];
  if (/\/admin\/contacts?(?:\/|$)/.test(path))
    return [`contact:${action}`, 'cms:contact:manage'];
  return [];
}

/** Permission decisions use freshly loaded DB claims. Explicit permissions override legacy role decorators. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      targets,
    );
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );
    if (!roles?.length && !permissions?.length) return true;
    const req = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      originalUrl?: string;
      url?: string;
      method: string;
      body?: Record<string, unknown>;
    }>();
    const user = req.user;
    if (!user || user.kind !== 'staff')
      throw new BizException(ERROR_CODES.FORBIDDEN, 'staff only', 403);
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    const owned = new Set(user.permissions ?? []);
    const inferred = permissionsForRequest(
      (req.originalUrl ?? req.url ?? '').split('?')[0],
      req.method,
      req.body,
    );
    // A known action requires its permission even when a legacy role happens to match.
    const allowed = permissions?.length
      ? permissions.every((p) => owned.has(p))
      : inferred.length
        ? inferred.some((p) => owned.has(p))
        : false;
    if (!allowed)
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'insufficient permissions',
        403,
      );
    return true;
  }
}
