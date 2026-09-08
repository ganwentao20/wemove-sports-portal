import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import { toPaged } from '../common/pagination.dto.js';
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from '../auth/passwords.util.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type {
  AuditQueryDto,
  ChangeMyPasswordDto,
  CreateStaffDto,
  SetStaffPasswordDto,
  StaffQueryDto,
  UpdateStaffDto,
  RoleCreateDto,
  RolePermissionsDto,
} from './dto/admin.dto.js';

/** 员工出参（永不含 passwordHash；角色以 codes 扁平输出，方便前端） */
const staffSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  permissionOverrides: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} as const;

type StaffRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  permissionOverrides?: unknown;
  mfaEnabled?: boolean;
  roles: { role: { id: string; code: string; name: string } }[];
};

function toStaffView(row: StaffRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    permissionOverrides: row.permissionOverrides,
    mfaEnabled: row.mfaEnabled,
    roles: row.roles.map((r) => r.role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  // ============================================================ Staff
  async listStaff(query: StaffQueryDto) {
    const where = {
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({
        where,
        select: staffSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.staff.count({ where }),
    ]);
    return toPaged(rows.map(toStaffView), total, query);
  }

  async getStaff(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: staffSelect,
    });
    if (!staff)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'staff not found', 404);
    return toStaffView(staff);
  }

  async createStaff(dto: CreateStaffDto, actor: JwtPayload) {
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.staff.findUnique({ where: { email } });
    if (exists)
      throw new BizException(ERROR_CODES.CONFLICT, 'email already exists', 409);

    this.assertRoleAssignment(actor, dto.roleCodes ?? []);
    const roles = await this.resolveRoles(dto.roleCodes ?? []);
    const passwordHash = await hashPassword(dto.password);

    const staff = await this.prisma.staff.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        status: 'ACTIVE',
        roles: { create: roles.map((r: any) => ({ roleId: r.id })) },
      },
      select: staffSelect,
    });

    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'staff.created',
      entityType: 'staff',
      entityId: staff.id,
      after: { email, name: dto.name, roles: roles.map((r: any) => r.code) },
    });
    return toStaffView(staff);
  }

  async updateStaff(id: string, dto: UpdateStaffDto, actor: JwtPayload) {
    if (dto.roleCodes) this.assertRoleAssignment(actor, dto.roleCodes);
    const assigned = dto.roleCodes
      ? await this.resolveRoles(dto.roleCodes)
      : null;
    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize all super-admin membership changes to prevent losing the final administrator.
      await tx.$queryRaw`SELECT "id" FROM "Role" WHERE "code" = 'SUPER_ADMIN' FOR UPDATE`;
      const current = await tx.staff.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      if (!current)
        throw new BizException(ERROR_CODES.NOT_FOUND, 'staff not found', 404);
      if (actor.sub === id && dto.status === 'DISABLED')
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'cannot disable your own account',
          400,
        );
      const isSuper = current.roles.some((r) => r.role.code === 'SUPER_ADMIN');
      if (isSuper && !actor.roles?.includes('SUPER_ADMIN'))
        throw new BizException(
          ERROR_CODES.FORBIDDEN,
          'only a super administrator can manage another super administrator',
          403,
        );
      if (
        isSuper &&
        (dto.status === 'DISABLED' ||
          (dto.roleCodes && !dto.roleCodes.includes('SUPER_ADMIN')))
      ) {
        const remaining = await tx.staff.count({
          where: {
            id: { not: id },
            status: 'ACTIVE',
            roles: { some: { role: { code: 'SUPER_ADMIN' } } },
          },
        });
        if (!remaining)
          throw new BizException(
            ERROR_CODES.CONFLICT,
            'at least one active super administrator is required',
            409,
          );
      }
      if (assigned) {
        await tx.staffRole.deleteMany({ where: { staffId: id } });
        await tx.staffRole.createMany({
          data: assigned.map((r) => ({ staffId: id, roleId: r.id })),
        });
      }
      return tx.staff.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.status
            ? {
                status: dto.status,
                ...(dto.status !== current.status
                  ? { authVersion: { increment: 1 } }
                  : {}),
              }
            : {}),
        },
        select: staffSelect,
      });
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'staff.updated',
      entityType: 'staff',
      entityId: id,
      after: {
        name: result.name,
        status: result.status,
        roles: result.roles.map((r) => r.role.code),
      },
    });
    return toStaffView(result);
  }

  async setStaffPermissions(
    id: string,
    dto: { grant: string[]; deny: string[] },
    actor: JwtPayload,
  ) {
    if (!actor.roles?.includes('SUPER_ADMIN'))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'only super administrators may set individual overrides',
        403,
      );
    await this.resolvePermissions([...dto.grant, ...dto.deny]);
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'staff not found', 404);
    const permissionOverrides = {
      grant: [...new Set(dto.grant)],
      deny: [...new Set(dto.deny)],
    };
    const result = await this.prisma.staff.update({
      where: { id },
      data: { permissionOverrides },
      select: staffSelect,
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'staff.permissions.updated',
      entityType: 'staff',
      entityId: id,
      before: staff.permissionOverrides,
      after: permissionOverrides,
    });
    return toStaffView(result);
  }

  private assertRoleAssignment(actor: JwtPayload, codes: string[]) {
    if (codes.includes('SUPER_ADMIN') && !actor.roles?.includes('SUPER_ADMIN'))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'only super administrators can assign SUPER_ADMIN',
        403,
      );
  }

  async resetStaffMfa(id: string, reason: string, actor: JwtPayload) {
    if (!actor.roles?.includes('SUPER_ADMIN'))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'super administrator required for MFA recovery',
        403,
      );
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'staff not found', 404);
    await this.prisma.staff.update({
      where: { id },
      data: {
        mfaSecret: null,
        mfaEnabled: false,
        mfaConfirmedAt: null,
        authVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'staff.mfa.admin_reset',
      entityType: 'staff',
      entityId: id,
      after: { reason },
    });
    return { ok: true, enrollmentRequired: true };
  }

  /** 管理员重置某员工密码 */
  async resetStaffPassword(
    id: string,
    dto: SetStaffPasswordDto,
    actor: JwtPayload,
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'staff not found', 404);
    const targetRoles = await this.prisma.staffRole.findMany({
      where: { staffId: id },
      include: { role: true },
    });
    if (
      targetRoles.some((r) => r.role.code === 'SUPER_ADMIN') &&
      !actor.roles?.includes('SUPER_ADMIN')
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'super administrator required',
        403,
      );
    await this.prisma.staff.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(dto.password),
        authVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'staff.password.reset',
      entityType: 'staff',
      entityId: id,
    });
    return { ok: true };
  }

  /** 员工修改自己的密码 */
  async changeMyPassword(payload: JwtPayload, dto: ChangeMyPasswordDto) {
    if (payload.kind !== 'staff') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'staff only', 403);
    }
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
    });
    if (
      !staff ||
      !(await verifyPassword(dto.oldPassword, staff.passwordHash))
    ) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'old password incorrect',
        400,
      );
    }
    await this.prisma.staff.update({
      where: { id: payload.sub },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        authVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: payload.sub,
      action: 'staff.password.change',
      entityType: 'staff',
      entityId: payload.sub,
    });
    return { ok: true };
  }

  // ============================================================ 角色 / 权限
  async listRoles() {
    const rows = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { code: true } } } },
        _count: { select: { staff: true } },
      },
    });
    return rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissionCodes: r.permissions.map((p: any) => p.permission.code),
      staffCount: r._count.staff,
    }));
  }

  async createRole(dto: RoleCreateDto, actor: JwtPayload) {
    const exists = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'role code already exists',
        409,
      );
    const perms = await this.resolvePermissions(dto.permissionCodes ?? []);

    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: {
          create: perms.map((p: any) => ({ permissionId: p.id })),
        },
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      after: { code: dto.code, permissions: perms.map((p: any) => p.code) },
    });
    return { id: role.id, code: role.code, name: role.name };
  }

  async setRolePermissions(
    roleId: string,
    dto: RolePermissionsDto,
    actor: JwtPayload,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { select: { permission: { select: { code: true } } } },
      },
    });
    if (!role)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'role not found', 404);

    const before = role.permissions.map((p: any) => p.permission.code);
    const perms = await this.resolvePermissions(dto.permissionCodes);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p: any) => ({ roleId, permissionId: p.id })),
      }),
    ]);
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'role.permissions.set',
      entityType: 'role',
      entityId: roleId,
      before: { permissions: before },
      after: { permissions: perms.map((p: any) => p.code) },
    });
    return { ok: true, permissionCodes: perms.map((p: any) => p.code) };
  }

  async listPermissions() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, group: true },
    });
    // 按 group 分组输出，方便后台按权限域渲染
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.group) ?? [];
      list.push(row);
      grouped.set(row.group, list);
    }
    return Array.from(grouped.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  }

  // ============================================================ 审计日志
  async listAudit(query: AuditQueryDto) {
    const where = {
      ...(query.actorKind ? { actorKind: query.actorKind } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          customer: { select: { id: true, email: true, name: true } },
          staff: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((r: any) => ({
      id: r.id,
      actorKind: r.actorKind,
      actor:
        r.actorKind === 'STAFF'
          ? r.staff
            ? { id: r.staff.id, email: r.staff.email, name: r.staff.name }
            : null
          : r.customer
            ? {
                id: r.customer.id,
                email: r.customer.email,
                name: r.customer.name,
              }
            : null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt,
    }));
    return toPaged(items, total, query);
  }

  // ============================================================ MFA（TOTP）
  /** 生成新密钥（启用状态下须先 disable；需要当前密码防越权启用） */
  async setupMfa(payload: JwtPayload, password: string) {
    this.assertStaff(payload);
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, passwordHash: true, mfaEnabled: true },
    });
    if (!staff)
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'staff account not found',
        401,
      );
    if (staff.mfaEnabled) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'MFA is enabled: disable it first',
        400,
      );
    }
    if (!(await verifyPassword(password, staff.passwordHash))) {
      throw new BizException(ERROR_CODES.VALIDATION, 'password incorrect', 400);
    }

    const setup = this.mfa.createSetup(staff.email);
    await this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        mfaSecret: setup.secret,
        mfaEnabled: false,
        mfaConfirmedAt: null,
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.mfa.setup',
      entityType: 'staff',
      entityId: staff.id,
    });
    return setup; // { secret, otpauthUrl }
  }

  /** 用动态码确认启用 */
  async confirmMfa(payload: JwtPayload, code: string) {
    this.assertStaff(payload);
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!staff)
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'staff account not found',
        401,
      );
    if (!staff.mfaSecret) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'run MFA setup first',
        400,
      );
    }
    await this.mfa.verifyWithLimit(staff.id, code, staff.mfaSecret);

    await this.prisma.staff.update({
      where: { id: staff.id },
      data: { mfaEnabled: true, mfaConfirmedAt: new Date() },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.mfa.enabled',
      entityType: 'staff',
      entityId: staff.id,
    });
    return { ok: true };
  }

  /** 停用并清除密钥 */
  async disableMfa(payload: JwtPayload, code: string) {
    this.assertStaff(payload);
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!staff)
      throw new BizException(
        ERROR_CODES.UNAUTHORIZED,
        'staff account not found',
        401,
      );
    if (!staff.mfaEnabled || !staff.mfaSecret) {
      throw new BizException(ERROR_CODES.VALIDATION, 'MFA not enabled', 400);
    }
    await this.mfa.verifyWithLimit(staff.id, code, staff.mfaSecret);

    await this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        mfaSecret: null,
        mfaEnabled: false,
        mfaConfirmedAt: null,
        authVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: staff.id,
      action: 'staff.mfa.disabled',
      entityType: 'staff',
      entityId: staff.id,
    });
    return { ok: true };
  }

  // ============================================================ 内部工具
  private assertStaff(payload: JwtPayload) {
    if (payload.kind !== 'staff') {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'staff only', 403);
    }
  }

  /** 校验角色编码集合存在并按序返回（未知编码 → 422） */
  private async resolveRoles(codes: string[]) {
    const unique = Array.from(new Set(codes));
    const roles = await this.prisma.role.findMany({
      where: { code: { in: unique } },
    });
    if (roles.length !== unique.length) {
      const found = new Set(roles.map((r: any) => r.code));
      const missing = unique.filter((c) => !found.has(c));
      throw new BizException(
        ERROR_CODES.VALIDATION,
        `unknown role codes: ${missing.join(', ')}`,
        400,
      );
    }
    return roles;
  }

  private async resolvePermissions(codes: string[]) {
    const unique = Array.from(new Set(codes));
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: unique } },
    });
    if (perms.length !== unique.length) {
      const found = new Set(perms.map((p: any) => p.code));
      const missing = unique.filter((c) => !found.has(c));
      throw new BizException(
        ERROR_CODES.VALIDATION,
        `unknown permission codes: ${missing.join(', ')}`,
        400,
      );
    }
    return perms;
  }
}
