import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import {
  AdminProductQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/catalog-admin.dto.js';

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CATALOG_OPERATOR')
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get('products')
  products(@Query() query: AdminProductQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Post('categories')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.createCategory(dto, actor);
  }

  @Post('products')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.createProduct(dto, actor);
  }

  @Patch('products/:id')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.updateProduct(id, dto, actor);
  }

  @Post('products/:id/variants')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  createVariant(
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.createVariant(id, dto, actor);
  }

  @Patch('variants/:id')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.updateVariant(id, dto, actor);
  }
}
