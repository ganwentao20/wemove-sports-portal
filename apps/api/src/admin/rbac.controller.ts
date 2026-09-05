import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Roles } from '../rbac/roles.guard.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { RoleCreateDto, RolePermissionsDto } from './dto/admin.dto.js';

/** 角色与权限管理（仅 SUPER_ADMIN；供后台角色配置页） */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class RbacAdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('roles')
  listRoles() {
    return this.admin.listRoles();
  }

  @Post('roles')
  createRole(@Body() dto: RoleCreateDto, @CurrentUser() actor: JwtPayload) {
    return this.admin.createRole(dto, actor);
  }

  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id') id: string,
    @Body() dto: RolePermissionsDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.admin.setRolePermissions(id, dto, actor);
  }

  @Get('permissions')
  listPermissions() {
    return this.admin.listPermissions();
  }
}
