import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { ChangeMyPasswordDto } from './dto/admin.dto.js';

/** 当前员工自助操作（仅需登录，不要求超管角色） */
@Controller('admin/me')
export class MeController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangeMyPasswordDto) {
    return this.admin.changeMyPassword(user, dto);
  }
}
