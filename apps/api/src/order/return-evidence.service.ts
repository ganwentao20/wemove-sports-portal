import { extname } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MediaService,
  type UploadedMediaFile,
} from '../media/media.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
type Evidence = {
  mediaId: string;
  attachmentToken: string;
  orderItemId: string;
};
@Injectable()
export class ReturnEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly redis: RedisService,
  ) {}
  private scope(orderId: string, userId: string) {
    return `retail-return-evidence:${orderId}:${userId}`;
  }
  private async order(actor: JwtPayload, id: string) {
    if (
      actor.kind === 'staff' &&
      !actor.roles?.includes('SUPER_ADMIN') &&
      !actor.permissions?.includes('order:read')
    )
      throw new ForbiddenException('Order permission required');
    const order = await this.prisma.order.findFirst({
      where: { id, ...(actor.kind === 'staff' ? {} : { userId: actor.sub }) },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
  async upload(actor: JwtPayload, orderId: string, file: UploadedMediaFile) {
    if (actor.kind !== 'customer')
      throw new ForbiddenException('Customer account required');
    const order = await this.order(actor, orderId);
    if (
      !order.items.some((item) => item.shippedQuantity > item.returnedQuantity)
    )
      throw new BadRequestException(
        'Return evidence requires a delivered or shipped item',
      );
    if (
      !file ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ||
      file.size > 5 * 1024 * 1024
    )
      throw new BadRequestException(
        'Upload a JPG, PNG or WebP image up to 5 MB',
      );
    const count = await this.redis.incrWithTtl(
      `wm:return-evidence:${actor.sub}`,
      3600,
    );
    if (count === null && process.env.NODE_ENV === 'production')
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'Upload service temporarily unavailable',
        503,
      );
    if ((count ?? 0) > 20)
      throw new BizException(
        ERROR_CODES.RATE_LIMIT,
        'Upload limit reached; try later',
        429,
      );
    const allowed: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    };
    if (
      !allowed[file.mimetype]?.includes(
        extname(file.originalname).toLowerCase(),
      )
    )
      throw new BadRequestException(
        'Image filename extension does not match its format',
      );
    const stored = await this.media.createDealerAttachment(file);
    await this.prisma.mediaAsset.update({
      where: { id: stored.mediaId },
      data: {
        resourceType: 'RETURN_EVIDENCE',
        usageLocations: [this.scope(orderId, actor.sub)],
      },
    });
    return stored;
  }
  async validate(
    tx: Prisma.TransactionClient,
    actor: JwtPayload,
    orderId: string,
    input: Evidence[],
    lineIds: string[],
  ) {
    if (
      input.length > 5 ||
      new Set(input.map((item) => item.mediaId)).size !== input.length
    )
      throw new BadRequestException('Attach up to five different images');
    if (!input.length) return [];
    for (const id of [...new Set(input.map((item) => item.mediaId))].sort())
      await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id"=${id} FOR UPDATE`;
    const rows = await tx.mediaAsset.findMany({
      where: {
        id: { in: input.map((item) => item.mediaId) },
        qualification: true,
        resourceType: 'RETURN_EVIDENCE',
        usageLocations: { has: this.scope(orderId, actor.sub) },
        scanStatus: {
          in:
            process.env.MEDIA_SCAN_REQUIRED === 'true'
              ? ['CLEAN']
              : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'],
        },
        createdAt: { gt: new Date(Date.now() - 86400_000) },
      },
    });
    return input.map((item) => {
      const file = rows.find(
        (row) => row.id === item.mediaId && row.key === item.attachmentToken,
      );
      if (!file || !lineIds.includes(item.orderItemId))
        throw new BadRequestException(
          'Invalid, expired or unauthorized return image',
        );
      return {
        mediaId: file.id,
        orderItemId: item.orderItemId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      };
    });
  }
  async remove(actor: JwtPayload, orderId: string, mediaId: string) {
    if (actor.kind !== 'customer')
      throw new ForbiddenException('Customer account required');
    await this.order(actor, orderId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id"=${mediaId} FOR UPDATE`;
      const file = await tx.mediaAsset.findFirst({
        where: {
          id: mediaId,
          resourceType: 'RETURN_EVIDENCE',
          usageLocations: { has: this.scope(orderId, actor.sub) },
        },
      });
      if (!file) throw new NotFoundException('Unsubmitted image not found');
      if (
        await tx.retailReturn.count({
          where: { attachments: { array_contains: [{ mediaId }] } },
        })
      )
        throw new BadRequestException(
          'Submitted return evidence is retained with its service record',
        );
      await tx.mediaAsset.update({
        where: { id: mediaId },
        data: {
          scanStatus: 'PENDING_DELETE',
          usageLocations: [],
          fileName: 'removed-return-image',
        },
      });
      const value = {
        mediaId,
        status: 'PENDING',
        attempts: 0,
        availableAt: new Date().toISOString(),
        lastError: null,
      };
      await tx.siteSetting.upsert({
        where: { key: `media-cleanup:${mediaId}` },
        create: { key: `media-cleanup:${mediaId}`, value },
        update: { value },
      });
    });
    return { queued: true };
  }
  async access(
    actor: JwtPayload,
    orderId: string,
    returnId: string,
    mediaId: string,
  ) {
    await this.order(actor, orderId);
    const request = await this.prisma.retailReturn.findFirst({
      where: { id: returnId, orderId },
    });
    if (
      !request ||
      !Array.isArray(request.attachments) ||
      !request.attachments.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          item.mediaId === mediaId,
      )
    )
      throw new NotFoundException('Return image not found');
    return this.media.sign(mediaId, 60);
  }
}
