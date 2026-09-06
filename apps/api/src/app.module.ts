import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { CartModule } from './cart/cart.module.js';
import { FallbackModule } from './common/fallback.module.js';

/**
 * 根模块 —— 业务模块按“纵向到人”拆分：
 * M1 组长：redis/email 基座 + auth(双体系/邮箱闭环/限流/登出黑名单) + rbac + audit
 *          + admin(员工管理/角色权限/审计查询)
 * MC 组员C：catalog(演示切片) + pricing(价格引擎)（订单/购物车模块待加入）
 * MB 组员B / MD 组员D：dealer / cms / media / contact 模块待加入（结构见 apps/api/README.md）
 *
 * 注意：FallbackModule（404 兜底）必须保持 imports 最后一位。
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EmailModule,
    HealthModule,
    AuthModule,
    AuditModule,
    AdminModule,
    CatalogModule,
    PricingModule,
    CartModule,
    FallbackModule,
  ],
})
export class AppModule {}
