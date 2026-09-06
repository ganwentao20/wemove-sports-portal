import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';

/**
 * 商品目录模块（MC 演示切片）：公开只读列表/详情。
 * 后续扩展：管理端 CRUD（RolesGuard）、变体价格编辑、库存扣减事务、购物车（均挂本模块或新 order 模块）。
 */
@Module({
  imports: [AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService, CatalogAdminService, RolesGuard, RequireMfaGuard],
  exports: [CatalogService, CatalogAdminService],
})
export class CatalogModule {}
