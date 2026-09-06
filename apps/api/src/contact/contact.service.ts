import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const leads = await this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      subject: lead.subject,
      content: lead.content,
      status: lead.status,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    }));
  }

  async create(dto: { name?: string; email?: string; subject?: string; content?: string; country?: string }) {
    const lead = await this.prisma.contactMessage.create({
      data: {
        name: dto.name ?? 'Anonymous',
        email: dto.email ?? 'unknown@example.com',
        subject: dto.subject ?? 'General Inquiry',
        content: dto.content ?? '',
        country: dto.country ?? null,
      },
    });

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      subject: lead.subject,
      content: lead.content,
      status: lead.status,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    };
  }

  async setStatus(id: string, status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
    const lead = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!lead) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'contact message not found', 404);
    }

    return this.prisma.contactMessage.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string) {
    const lead = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!lead) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'contact message not found', 404);
    }
    await this.prisma.contactMessage.delete({ where: { id } });
    return { ok: true };
  }
}
