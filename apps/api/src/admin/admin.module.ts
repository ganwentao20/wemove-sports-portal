import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { StaffController } from './staff.controller.js';
import { MeController } from './me.controller.js';
import { RbacAdminController } from './rbac.controller.js';
import { AuditAdminController } from './audit.controller.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';

/**
 * 后台管理模块（组长）：
 * - 员工管理（CRUD/角色分配/密码重置，仅 SUPER_ADMIN）
 * - 角色/权限配置（仅 SUPER_ADMIN）
 * - 审计日志查询（仅 SUPER_ADMIN）
 * 所有写操作均经 AuditService 留痕（before/after 变更值）。
 * 注：业务域管理接口（商品/订单/B2B/CMS 等）由对应组员在各自模块内以相同门禁模式扩展。
 */
@Module({
  imports: [AuditModule, AuthModule, RedisModule],
  controllers: [StaffController, MeController, RbacAdminController, AuditAdminController],
  providers: [AdminService, RolesGuard],
  exports: [AdminService],
})
export class AdminModule {}
