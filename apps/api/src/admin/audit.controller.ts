import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Roles } from '../rbac/roles.guard.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AuditQueryDto } from './dto/admin.dto.js';

/** 审计日志查询（操作人/动作/对象多维过滤 + 分页；供后台审计日志页） */
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AuditAdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.admin.listAudit(query);
  }
}
