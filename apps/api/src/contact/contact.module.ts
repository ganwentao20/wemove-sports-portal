import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, RedisModule, MfaModule],
  controllers: [ContactController],
  providers: [ContactService, RolesGuard, RequireMfaGuard],
  exports: [ContactService],
})
export class ContactModule {}
