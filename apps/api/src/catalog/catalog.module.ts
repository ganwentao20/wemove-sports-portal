import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';

/**
 * 商品目录模块（MC 演示切片）：公开只读列表/详情。
 * 后续扩展：管理端 CRUD（RolesGuard）、变体价格编辑、库存扣减事务、购物车（均挂本模块或新 order 模块）。
 */
@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
