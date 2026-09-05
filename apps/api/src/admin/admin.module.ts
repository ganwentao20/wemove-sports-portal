import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { StaffController } from './staff.controller.js';
import { MeController } from './me.controller.js';
import { RbacAdminController } from './rbac.controller.js';
import { AuditAdminController } from './audit.controller.js';
import { MfaController } from './mfa.controller.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { MfaModule } from '../mfa/mfa.module.js';

/**
 * 后台管理模块（组长）：
 * - 员工管理（CRUD/角色分配/密码重置）与角色/权限配置：SUPER_ADMIN + MFA 二次认证
 * - 审计日志查询（SUPER_ADMIN）
 * - MFA(TOTP) 自助：setup/confirm/disable
 * 所有写操作均经 AuditService 留痕（before/after 变更值）。
 * 注：业务域管理接口（商品/订单/B2B/CMS 等）由对应组员在各模块内以相同门禁模式扩展。
 */
@Module({
  imports: [AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [
    StaffController,
    MeController,
    RbacAdminController,
    AuditAdminController,
    MfaController,
  ],
  providers: [AdminService, RolesGuard, RequireMfaGuard],
  exports: [AdminService],
})
export class AdminModule {}
