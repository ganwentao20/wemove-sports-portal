import { Module } from '@nestjs/common';
import { MfaService } from './mfa.service.js';
import { RequireMfaGuard } from './require-mfa.guard.js';
import { RedisModule } from '../redis/redis.module.js';

/**
 * MFA 模块（组长）：TOTP 二次认证。
 * 其他成员做敏感写操作时复用：
 *   import { RequireMfa } from '../mfa/require-mfa.guard.js';
 *   @UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard) + @RequireMfa()
 * （模块需 imports: MfaModule）
 */
@Module({
  imports: [RedisModule],
  providers: [MfaService, RequireMfaGuard],
  exports: [MfaService, RequireMfaGuard],
})
export class MfaModule {}
