import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { DealerService } from './dealer.service.js';
import { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';
import { DealerCatalogQueryDto } from './dto/dealer-catalog-query.dto.js';
import { QuickOrderDto } from './dto/quick-order.dto.js';

/**
 * MB：经销商申请入口。
 * - POST 提交公开（携带登录态自动绑定 applicantId，归属校验强依据）
 * - GET 详情仅登录后的本人（applicantId）或已关联企业成员（companyId）可见
 */
@Controller('dealer')
export class DealerController {
  constructor(private readonly dealer: DealerService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('applications')
  createApplication(
    @Body() dto: CreateDealerApplicationDto,
    @Ip() ip?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.dealer.createApplication(dto, ip, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:id')
  findApplication(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.dealer.findApplication(id, user);
  }

  /** F-B04：仅已审批企业成员可见的目录与成交价。 */
  @UseGuards(JwtAuthGuard)
  @Get('catalog')
  catalog(
    @Query() query: DealerCatalogQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealer.listDealerCatalog(query.quantity, user);
  }

  /** DLR-04：批量 SKU/数量逐行校验和企业价格预览，不创建业务单据。 */
  @UseGuards(JwtAuthGuard)
  @Post('quick-order/validate')
  validateQuickOrder(
    @Body() dto: QuickOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealer.validateQuickOrder(dto.lines, user);
  }
}
