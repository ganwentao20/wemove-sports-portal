import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { Roles, RolesGuard } from '../rbac/roles.guard.js';
import { DealerService } from './dealer.service.js';
import {
  DealerApplicationQueryDto,
  ReviewDealerApplicationDto,
} from './dto/review-dealer-application.dto.js';

/** F-B03：经销商审核工作台 API；仅 SUPER_ADMIN 可访问，写操作由服务层留审计记录。 */
@Controller('admin/dealer/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DealerAdminController {
  constructor(private readonly dealer: DealerService) {}

  @Get()
  list(@Query() query: DealerApplicationQueryDto) {
    return this.dealer.listApplications(query.status);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewDealerApplicationDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip?: string,
  ) {
    return this.dealer.reviewApplication(id, dto, actor, ip);
  }
}
