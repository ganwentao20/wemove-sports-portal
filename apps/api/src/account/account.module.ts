import { DealerTermsController } from './dealer-terms.controller.js';
import { MediaModule } from '../media/media.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MfaModule } from '../mfa/mfa.module.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import {
  AccountController,
  AccountAdminController,
} from './account.controller.js';
import { AccountService } from './account.service.js';
@Module({
  imports: [AuthModule, AuditModule, MfaModule, MediaModule],
  controllers: [
    AccountController,
    AccountAdminController,
    DealerTermsController,
  ],
  providers: [AccountService, RolesGuard, RequireMfaGuard],
})
export class AccountModule {}
