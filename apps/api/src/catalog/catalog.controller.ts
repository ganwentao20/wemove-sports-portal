import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto } from './dto/catalog.dto.js';

/** 公开商品目录（Portal PLP/PDP 数据源；无需登录） */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  list(@Query() query: CatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get('products/:slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.findBySlug(slug);
  }
}
