import { Injectable } from '@nestjs/common';
import { ContactStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { CreateContactDto } from './dto/contact.dto.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const leads = await this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return leads;
  }

  async create(dto: CreateContactDto, ip?: string) {
    const lead = await this.prisma.contactMessage.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject.trim(),
        content: dto.content.trim(),
        country: dto.country?.trim() || null,
      },
    });
    void this.audit.record({
      actorKind: 'ANON',
      action: 'contact.create',
      entityType: 'contactMessage',
      entityId: lead.id,
      after: { subject: lead.subject, country: lead.country },
      ip,
    });
    return { id: lead.id, status: lead.status, createdAt: lead.createdAt };
  }

  async setStatus(
    id: string,
    status: ContactStatus,
    actor: JwtPayload,
    ip?: string,
  ) {
    const lead = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!lead) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'contact message not found',
        404,
      );
    }

    const updated = await this.prisma.contactMessage.update({
      where: { id },
      data: {
        status,
        handledBy: status === ContactStatus.NEW ? null : actor.sub,
        handledAt: status === ContactStatus.NEW ? null : new Date(),
      },
    });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'contact.status.update',
      entityType: 'contactMessage',
      entityId: id,
      before: { status: lead.status },
      after: { status: updated.status },
      ip,
    });
    return updated;
  }

  async remove(id: string, actor: JwtPayload, ip?: string) {
    const lead = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!lead) {
      throw new BizException(
        ERROR_CODES.NOT_FOUND,
        'contact message not found',
        404,
      );
    }
    await this.prisma.contactMessage.delete({ where: { id } });
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'contact.delete',
      entityType: 'contactMessage',
      entityId: id,
      before: { status: lead.status, subject: lead.subject },
      ip,
    });
    return { ok: true };
  }
}
