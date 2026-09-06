import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { MfaCodeDto, MfaSetupDto } from './dto/admin.dto.js';

/**
 * MFA（TOTP）自助管理：
 * POST setup   生成新密钥与 otpauth URL（需当前密码；启用状态下需先 disable）
 * POST confirm 用动态码确认启用（6 位；连续错 5 次锁 15 分钟）
 * POST disable 用动态码停用（密钥一并清除）
 */
@Controller('admin/me/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly admin: AdminService) {}

  @HttpCode(200)
  @Post('setup')
  setup(@CurrentUser() user: JwtPayload, @Body() dto: MfaSetupDto) {
    return this.admin.setupMfa(user, dto.password);
  }

  @HttpCode(200)
  @Post('confirm')
  confirm(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    return this.admin.confirmMfa(user, dto.code);
  }

  @HttpCode(200)
  @Post('disable')
  disable(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    return this.admin.disableMfa(user, dto.code);
  }
}
