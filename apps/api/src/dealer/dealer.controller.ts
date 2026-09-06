import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { DealerService } from './dealer.service.js';
import { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';

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
}
