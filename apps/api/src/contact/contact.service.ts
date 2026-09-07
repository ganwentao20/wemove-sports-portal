import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ContactStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  ContactQueryDto,
  ContactReplyDto,
  UpdateContactDto,
} from './dto/contact.dto.js';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
import type { CreateContactDto } from './dto/contact.dto.js';
import { RedisService } from '../redis/redis.service.js';
import {
  MediaService,
  type UploadedMediaFile,
} from '../media/media.service.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly redis: RedisService,
    private readonly media: MediaService,
  ) {}

  private filters(query: ContactQueryDto): Prisma.ContactMessageWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.assignedTo
        ? {
            assignedTo:
              query.assignedTo === 'UNASSIGNED' ? null : query.assignedTo,
          }
        : {}),
      ...(query.assignedTeam?.trim()
        ? {
            assignedTeam: {
              equals: query.assignedTeam.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(search
        ? {
            OR: ['name', 'email', 'subject', 'content'].map((field) => ({
              [field]: { contains: search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
  }

  async list(query: ContactQueryDto) {
    const where = this.filters(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async exportRows(query: ContactQueryDto, actor: JwtPayload) {
    const rows = await this.prisma.contactMessage.findMany({
      where: this.filters(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        source: true,
        subject: true,
        status: true,
        priority: true,
        assignedTo: true,
        assignedTeam: true,
        tags: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'contact.export',
      entityType: 'ContactMessage',
      after: {
        count: rows.length,
        status: query.status,
        priority: query.priority,
        source: query.source,
        hasSearch: Boolean(query.search?.trim()),
      },
    });
    return rows.map((row) => ({
      ...row,
      tags: row.tags.join('; '),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateContactDto, ip?: string) {
    const email = dto.email.trim().toLowerCase(),
      name = dto.name.trim(),
      subject = dto.subject.trim(),
      content = dto.content.trim(),
      attachments = dto.attachments ?? [];
    if (name.length < 2 || subject.length < 2 || content.length < 10)
      throw new BadRequestException(
        'Name, subject and message need meaningful text',
      );
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          email,
          name,
          subject,
          content,
          country: dto.country?.trim() || null,
          source: dto.source ?? 'CONTACT',
          attachments: attachments.map((a) => a.mediaId),
        }),
      )
      .digest('hex');
    const { lead, created } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`contact:${email}`},0))`;
        const keyMatch = dto.submissionKey
          ? await tx.contactMessage.findFirst({
              where: {
                email,
                history: {
                  path: ['0', 'submissionKey'],
                  equals: dto.submissionKey,
                },
              },
            })
          : null;
        if (keyMatch) {
          const first = (
            keyMatch.history as Array<Record<string, unknown>>
          )?.[0];
          if (first?.payloadHash !== payloadHash)
            throw new ConflictException(
              'Submission key was already used for a different message',
            );
          return { lead: keyMatch, created: false };
        }
        const duplicate = await tx.contactMessage.findFirst({
          where: {
            email,
            createdAt: { gt: new Date(Date.now() - 600_000) },
            history: { path: ['0', 'payloadHash'], equals: payloadHash },
          },
        });
        if (duplicate) return { lead: duplicate, created: false };
        const [recipientCount, ipCount] = await Promise.all([
          this.redis.incrWithTtl(
            `wm:contact:recipient:${createHash('sha256').update(email).digest('hex')}`,
            3600,
          ),
          this.redis.incrWithTtl(
            `wm:contact:request:${ip ?? 'anonymous'}`,
            3600,
          ),
        ]);
        if (
          (recipientCount === null || ipCount === null) &&
          process.env.NODE_ENV === 'production'
        )
          throw new BizException(
            ERROR_CODES.RATE_LIMIT,
            'Contact service temporarily unavailable',
            503,
          );
        if ((recipientCount ?? 0) > 5 || (ipCount ?? 0) > 30)
          throw new BizException(
            ERROR_CODES.RATE_LIMIT,
            'Too many contact requests; please try later',
            429,
          );
        const assets = await tx.mediaAsset.findMany({
          where: {
            id: { in: attachments.map((a) => a.mediaId) },
            qualification: true,
            uploadedById: null,
            scanStatus: {
              in:
                process.env.MEDIA_SCAN_REQUIRED === 'true'
                  ? ['CLEAN']
                  : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'],
            },
            createdAt: { gt: new Date(Date.now() - 86400_000) },
          },
        });
        if (
          assets.length !== attachments.length ||
          attachments.some(
            (item) =>
              !assets.some(
                (asset) =>
                  asset.id === item.mediaId &&
                  asset.key === item.attachmentToken,
              ),
          )
        )
          throw new BadRequestException('Invalid or expired attachment');
        const lead = await tx.contactMessage.create({
          data: {
            name,
            email,
            subject,
            content,
            country: dto.country?.trim() || null,
            source: dto.source,
            attachments: attachments.map((a) => a.mediaId),
            history: [
              {
                at: new Date().toISOString(),
                action: 'created',
                consentVersion: dto.consentVersion,
                consent: true,
                submissionKey: dto.submissionKey ?? payloadHash,
                payloadHash,
              },
            ],
          },
        });
        return { lead, created: true };
      },
      { timeout: 15000 },
    );
    if (created) {
      await this.audit.record({
        actorKind: 'ANON',
        action: 'contact.create',
        entityType: 'contactMessage',
        entityId: lead.id,
        after: { subject: lead.subject, country: lead.country },
        ip,
      });
    }
    // A retry also repairs an outbox enqueue that failed after the DB committed;
    // the notification dedupe key prevents repeated delivery.
    await this.notifications.enqueue({
      kind: 'contact.received',
      to: lead.email,
      subject: 'We received your WEMOVE request',
      text: `Request ${lead.id}: ${lead.subject}\nOur support team will reply to this email.`,
      dedupeKey: `contact.received:${lead.id}`,
    });
    return { id: lead.id, status: lead.status, createdAt: lead.createdAt };
  }

  async attachment(file: UploadedMediaFile, ip?: string) {
    if (!file) throw new BadRequestException('A file is required');
    const count = await this.redis.incrWithTtl(
      `wm:contact:upload:${ip ?? 'anon'}`,
      3600,
    );
    if (count === null && process.env.DEPLOYMENT_ENV === 'production')
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'Upload unavailable, please retry later',
        503,
      );
    if (count !== null && count > 15)
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'Upload limit reached',
        429,
      );
    return this.media.createDealerAttachment(file);
  }
  async attachmentAccess(id: string, mediaId: string) {
    const lead = await this.prisma.contactMessage.findUniqueOrThrow({
      where: { id },
    });
    if (!lead.attachments.includes(mediaId))
      throw new BadRequestException('File does not belong to this request');
    return this.media.sign(mediaId);
  }
  assignees() {
    return this.prisma.staff.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async update(
    id: string,
    input: UpdateContactDto,
    actor: JwtPayload,
    ip?: string,
    action = 'contact.update',
  ) {
    if (
      input.assignedTo &&
      !(await this.prisma.staff.findFirst({
        where: { id: input.assignedTo, status: 'ACTIVE' },
      }))
    )
      throw new BadRequestException('Assigned staff must be active');
    const data = {
      ...input,
      ...(input.assignedTo !== undefined
        ? { assignedTo: input.assignedTo || null }
        : {}),
      ...(input.assignedTeam !== undefined
        ? { assignedTeam: input.assignedTeam.trim() || null }
        : {}),
      ...(input.tags
        ? {
            tags: [
              ...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
            ],
          }
        : {}),
    };
    const { before, after } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id=${id} FOR UPDATE`;
      const before = await tx.contactMessage.findUnique({ where: { id } });
      if (!before)
        throw new BizException(
          ERROR_CODES.NOT_FOUND,
          'contact message not found',
          404,
        );
      const resolved = input.status === 'RESOLVED' || input.status === 'CLOSED';
      const after = await tx.contactMessage.update({
        where: { id },
        data: {
          ...data,
          ...(input.status
            ? {
                handledBy: resolved ? actor.sub : null,
                handledAt: resolved ? (before.handledAt ?? new Date()) : null,
              }
            : {}),
          history: [
            ...(Array.isArray(before.history) ? before.history : []),
            {
              at: new Date().toISOString(),
              actorId: actor.sub,
              action:
                input.status && input.status !== before.status
                  ? 'status'
                  : 'update',
              changes: data,
            },
          ] as Prisma.InputJsonValue,
        },
      });
      if (input.status && input.status !== before.status)
        await this.notifications.enqueue(
          {
            kind: 'contact.status',
            to: after.email,
            subject: 'Your WEMOVE support request was updated',
            text: `Request ${id}: ${after.status}`,
            dedupeKey: `contact.status:${id}:${after.updatedAt.toISOString()}`,
          },
          tx,
        );
      return { before, after };
    });
    const values = (row: typeof before) => ({
      status: row.status,
      assignedTo: row.assignedTo,
      assignedTeam: row.assignedTeam,
      priority: row.priority,
      tags: row.tags,
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action,
      entityType: 'ContactMessage',
      entityId: id,
      before: values(before),
      after: values(after),
      ip,
    });
    return after;
  }

  async reply(id: string, input: ContactReplyDto, actor: JwtPayload) {
    const text = input.text.trim();
    if (text.length < 2)
      throw new BadRequestException('Message needs meaningful text');
    const entry = {
      at: new Date().toISOString(),
      actorId: actor.sub,
      action: input.internal ? 'note' : 'reply',
      text,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id=${id} FOR UPDATE`;
      const current = await tx.contactMessage.findUniqueOrThrow({
        where: { id },
      });
      const result = await tx.contactMessage.update({
        where: { id },
        data: {
          history: [
            ...(Array.isArray(current.history) ? current.history : []),
            entry,
          ] as Prisma.InputJsonValue,
        },
      });
      if (!input.internal)
        await this.notifications.enqueue(
          {
            kind: 'contact.reply',
            to: current.email,
            subject: `Re: ${current.subject}`,
            text,
            dedupeKey: `contact.reply:${id}:${entry.at}`,
          },
          tx,
        );
      return result;
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: `contact.${entry.action}`,
      entityType: 'ContactMessage',
      entityId: id,
      after: { internal: input.internal },
    });
    return updated;
  }

  setStatus(id: string, status: ContactStatus, actor: JwtPayload, ip?: string) {
    return this.update(id, { status }, actor, ip, 'contact.status.update');
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
