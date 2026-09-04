import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AuditModule } from '../audit/audit.module.js';

/**
 * 认证模块（组长）：JwtModule 全局注册（guard 也可注入 JwtService）。
 * 密钥经 env JWT_ACCESS_SECRET 注入；生产强制替换（见 .env.example）。
 */
@Module({
  imports: [
    JwtModule.register({ global: true }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
