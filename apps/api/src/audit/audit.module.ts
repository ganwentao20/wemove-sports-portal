import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

/** 审计模块：AuditService 全模块可注入 */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
