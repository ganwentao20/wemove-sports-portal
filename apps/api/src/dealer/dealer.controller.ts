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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { DealerService } from './dealer.service.js';
import { CreateDealerApplicationDto } from './dto/dealer-application.dto.js';

/** MB：经销商申请入口；提交公开，详情仅登录后的本人或已关联企业成员可见。 */
@Controller('dealer')
export class DealerController {
  constructor(private readonly dealer: DealerService) {}

  @Post('applications')
  createApplication(
    @Body() dto: CreateDealerApplicationDto,
    @Ip() ip?: string,
  ) {
    return this.dealer.createApplication(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:id')
  findApplication(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.dealer.findApplication(id, user);
  }
}
