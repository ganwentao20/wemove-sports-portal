import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { CmsController } from './cms.controller.js';
import { CmsService } from './cms.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [CmsController],
  providers: [CmsService, RolesGuard, RequireMfaGuard],
  exports: [CmsService],
})
export class CmsModule {}
