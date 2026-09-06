import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [MediaController],
  providers: [MediaService, RolesGuard, RequireMfaGuard],
  exports: [MediaService],
})
export class MediaModule {}
