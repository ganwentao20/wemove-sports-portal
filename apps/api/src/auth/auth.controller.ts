import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { JwtPayload } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  ResendVerificationDto,
  StaffLoginDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';

/**
 * 认证接口（双体系 + 邮箱闭环）：
 * - C 端/经销商成员：register / verify-email / resend-verification / login / forgot-password / reset-password
 * - 后台员工（Admin）：staff/login（与 C 端物理隔离）
 * - 通用：me（需登录）、logout（JWT 登出，加入 Redis 黑名单）
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip?: string) {
    return this.auth.register(dto, ip);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip?: string) {
    return this.auth.login(dto, ip);
  }

  @HttpCode(200)
  @Post('staff/login')
  staffLogin(@Body() dto: StaffLoginDto, @Ip() ip?: string) {
    return this.auth.staffLogin(dto, ip);
  }

  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.auth.logout(user);
  }
}
