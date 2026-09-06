import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { PricingAdminService } from './pricing-admin.service.js';
import {
  CreatePricingRuleDto,
  PricingRuleQueryDto,
  ResolvePriceQueryDto,
  UpdatePricingRuleDto,
} from './dto/pricing.dto.js';

@Controller('admin/pricing-rules')
@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard)
@Roles('SUPER_ADMIN', 'CATALOG_OPERATOR')
@RequireMfa()
export class PricingAdminController {
  constructor(private readonly service: PricingAdminService) {}

  @Get()
  list(@Query() query: PricingRuleQueryDto) {
    return this.service.list(query);
  }

  @Get('resolve')
  resolve(@Query() query: ResolvePriceQueryDto) {
    return this.service.resolveDealerPriceFor(query.variantId, query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post()
  create(@Body() dto: CreatePricingRuleDto, @CurrentUser() actor: JwtPayload) {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingRuleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.service.remove(id, actor);
  }
}
