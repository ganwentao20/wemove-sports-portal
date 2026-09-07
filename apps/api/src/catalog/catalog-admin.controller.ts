import { ProductRatingDto } from './dto/product-rating.dto.js';
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
import {
  CatalogImportDto,
  CategoryTemplateDto,
  CopyProductDto,
} from './dto/catalog-admin.dto.js';

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CATALOG_OPERATOR')
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get('export') export() {
    return this.catalog.exportProducts();
  }
  @Post('import') @UseGuards(RequireMfaGuard) @RequireMfa() import(
    @Body() dto: CatalogImportDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.importProducts(dto, actor);
  }
  @Get('variants/:id/price-history') history(@Param('id') id: string) {
    return this.catalog.priceHistory(id);
  }
  @Patch('categories/:id/template')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  template(
    @Param('id') id: string,
    @Body() dto: CategoryTemplateDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.categoryTemplate(id, dto, actor);
  }
  @Post('products/:id/copy') @UseGuards(RequireMfaGuard) @RequireMfa() copy(
    @Param('id') id: string,
    @Body() dto: CopyProductDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.copyProduct(id, dto.slug, dto.skuPrefix, actor);
  }

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

  @Patch('categories/:id')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  updateCategory(
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.updateCategory(id, dto, actor);
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

  @Patch('products/:id/reviews')
  @UseGuards(RequireMfaGuard)
  @RequireMfa()
  rating(
    @Param('id') id: string,
    @Body() dto: ProductRatingDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.catalog.updateRating(id, dto, actor);
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
