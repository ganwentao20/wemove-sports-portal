import { RetentionService } from './retention.service.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';
import { SeoMapController } from './seo-map.controller.js';
import { CacheVersionController } from './cache-version.controller.js';
@Module({
  imports: [PrismaModule, AuditModule, AuthModule, MfaModule],
  controllers: [PlatformController, SeoMapController, CacheVersionController],
  providers: [RetentionService, PlatformService, RolesGuard, RequireMfaGuard],
  exports: [PlatformService],
})
export class PlatformModule {}
