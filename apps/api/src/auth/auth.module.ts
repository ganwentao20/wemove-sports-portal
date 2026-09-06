import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { EmailModule } from '../email/email.module.js';

/**
 * 认证模块（组长）：JwtModule 全局注册（guard 也可注入 JwtService）。
 * 密钥经 env JWT_ACCESS_SECRET 注入；生产强制替换（见 .env.example）。
 * RedisModule：登录限流 + 登出黑名单；EmailModule：验证/找回邮件。
 */
@Module({
  imports: [JwtModule.register({ global: true }), AuditModule, RedisModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
