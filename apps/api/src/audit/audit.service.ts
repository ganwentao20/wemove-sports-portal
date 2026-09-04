import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorKind: 'ANON' | 'CUSTOMER' | 'STAFF';
  actorCustomerId?: string | null;
  actorStaffId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

/**
 * 审计服务（组长）：敏感操作全量留痕。
 * 调用方用 void audit.record({...}) 触发（fire-and-forget，写失败不影响主流程但记录 error 日志）。
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorKind: entry.actorKind,
          actorCustomerId: entry.actorCustomerId ?? null,
          actorStaffId: entry.actorStaffId ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
          after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`audit record failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
