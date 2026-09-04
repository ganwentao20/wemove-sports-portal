import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { FallbackModule } from './common/fallback.module.js';

/**
 * 根模块 —— 业务模块按“纵向到人”拆分：
 * M1 组长：auth(用户/员工双体系) + rbac(守卫/装饰器，见 auth/rbac 目录) + audit
 * MC 组员C：catalog(演示切片) + pricing(价格引擎)（订单/购物车模块待加入）
 * MB 组员B / MD 组员D：dealer / cms / media / contact 模块待加入（结构见 apps/api/README.md）
 *
 * 注意：FallbackModule（404 兜底）必须保持 imports 最后一位。
 */
@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    CatalogModule,
    PricingModule,
    FallbackModule,
  ],
})
export class AppModule {}
