import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import {
  Permissions,
  Roles,
  RolesGuard,
  permissionsForRequest,
} from './roles.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
function ctx(
  user: JwtPayload | undefined,
  path: string,
  method = 'GET',
  body?: Record<string, unknown>,
): ExecutionContext {
  class Controller {}
  Roles('SUPER_ADMIN', 'CATALOG_OPERATOR')(Controller);
  return {
    getHandler: () => function handler() {},
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => ({ user, originalUrl: path, method, body }),
    }),
  } as unknown as ExecutionContext;
}
const staff = (
  permissions: string[],
  roles = ['CATALOG_OPERATOR'],
): JwtPayload => ({
  sub: 'staff',
  kind: 'staff',
  email: 'test@example.test',
  name: 'Test',
  roles,
  permissions,
});
describe('runtime permission guard', () => {
  const guard = new RolesGuard(new Reflector());
  it('does not let a legacy role bypass a revoked action permission', () => {
    expect(() =>
      guard.canActivate(ctx(staff([]), '/api/v1/admin/catalog/products')),
    ).toThrow('insufficient permissions');
  });
  it('separates catalog read, publish and export while accepting a legacy broad write grant', () => {
    expect(
      guard.canActivate(
        ctx(staff(['catalog:product:read']), '/api/v1/admin/catalog/products'),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        ctx(staff(['catalog:product:read']), '/api/v1/admin/catalog/export'),
      ),
    ).toThrow();
    expect(() =>
      guard.canActivate(
        ctx(
          staff(['catalog:product:edit']),
          '/api/v1/admin/catalog/products/id',
          'PATCH',
          { status: 'ACTIVE' },
        ),
      ),
    ).toThrow();
    expect(
      guard.canActivate(
        ctx(
          staff(['catalog:product:publish']),
          '/api/v1/admin/catalog/products/id',
          'PATCH',
          { status: 'ACTIVE' },
        ),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctx(
          staff(['catalog:product:write']),
          '/api/v1/admin/catalog/products/id',
          'PATCH',
          { status: 'ARCHIVED' },
        ),
      ),
    ).toBe(true);
  });
  it('handles existing CMS/contact/media/pricing paths with action permissions', () => {
    for (const [path, permissions, method] of [
      ['/api/v1/cms/pages', ['cms:write'], 'POST'],
      ['/api/v1/contacts', ['contact:read'], 'GET'],
      ['/api/v1/media', ['media:read'], 'GET'],
      ['/api/v1/admin/pricing-rules', ['catalog:price:write'], 'POST'],
    ] as const)
      expect(
        guard.canActivate(
          ctx(staff([...permissions], ['CUSTOM_OPERATOR']), path, method),
        ),
      ).toBe(true);
  });
  it('denies customers and unknown protected actions; super administrator remains full access', () => {
    expect(() =>
      guard.canActivate(
        ctx(
          { ...staff([]), kind: 'customer' },
          '/api/v1/admin/catalog/products',
        ),
      ),
    ).toThrow('staff only');
    expect(() =>
      guard.canActivate(ctx(staff([]), '/api/v1/unknown/admin/action')),
    ).toThrow();
    expect(
      guard.canActivate(
        ctx(staff([], ['SUPER_ADMIN']), '/api/v1/unknown/admin/action'),
      ),
    ).toBe(true);
  });
  it('requires every explicit permission, overriding the legacy route mapping', () => {
    class Controller {}
    Permissions('cms:read', 'reports:read')(Controller);
    const context = ctx(staff(['cms:read']), '/api/v1/cms/pages');
    context.getClass = (() => Controller) as ExecutionContext['getClass'];
    expect(() => guard.canActivate(context)).toThrow();
  });
  it('recognizes create, import and archive action codes', () => {
    expect(
      permissionsForRequest('/api/v1/admin/catalog/products', 'POST'),
    ).toContain('catalog:product:create');
    expect(
      permissionsForRequest('/api/v1/admin/catalog/import', 'POST'),
    ).toContain('catalog:product:import');
    expect(
      permissionsForRequest('/api/v1/admin/catalog/products/id', 'PATCH', {
        status: 'ARCHIVED',
      }),
    ).toContain('catalog:product:archive');
  });
});
