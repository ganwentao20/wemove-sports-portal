import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile, readFile } from 'node:fs/promises';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { MediaMetadataDto } from './media.dto.js';
import type { MediaAsset, Prisma } from '@prisma/client';
import { catalogVariantWhere, catalogWhere } from '../dealer/catalog-policy.js';
import { extname, join } from 'node:path';
import { AuditService } from '../audit/audit.service.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';

type MediaVisibility = 'PUBLIC' | 'REGISTERED' | 'DEALER_ONLY' | 'INTERNAL';
type StoredMedia = {
  stream: ReturnType<typeof createReadStream>;
  fileName: string;
  mimeType: string;
};
export type UploadedMediaFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleanupBusy = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly storageRoot = join(process.cwd(), 'media_private');
  onModuleInit() {
    if (process.env.MEDIA_CLEANUP_WORKER === 'false') return;
    this.cleanupTimer = setInterval(() => {
      void this.drainQualificationCleanup().catch(() =>
        this.logger.warn('Qualification cleanup retry remains pending'),
      );
    }, 60_000);
    this.cleanupTimer.unref();
  }
  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
  private safeScanStatuses() {
    return process.env.MEDIA_SCAN_REQUIRED === 'true'
      ? ['CLEAN']
      : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'];
  }

  private derivativeIds(value: Prisma.JsonValue | Prisma.InputJsonArray) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) =>
      item &&
      typeof item === 'object' &&
      'mediaId' in item &&
      typeof item.mediaId === 'string'
        ? [item.mediaId]
        : [],
    );
  }

  private async removeDerived(ids: string[]) {
    if (!ids.length) return;
    const files = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids } },
    });
    await Promise.all(files.map((file) => this.removeStored(file.key)));
    await this.prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
  }

  private async removeStored(key: string) {
    await unlink(join(this.storageRoot, key)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      },
    );
  }

  private signingSecret() {
    return (
      process.env.MEDIA_SIGNING_SECRET ??
      process.env.JWT_ACCESS_SECRET ??
      'dev_only_change_me_media'
    );
  }

  private signature(id: string, expires: number) {
    return createHmac('sha256', this.signingSecret())
      .update(`${id}:${expires}`)
      .digest('hex');
  }

  private validSignature(
    id: string,
    expires: string | undefined,
    signature: string | undefined,
  ) {
    if (!expires || !signature) return false;
    const expiresAt = Number(expires);
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt < Math.floor(Date.now() / 1000)
    )
      return false;
    const expected = Buffer.from(this.signature(id, expiresAt), 'utf8');
    const actual = Buffer.from(signature, 'utf8');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  async list() {
    const files = await this.prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: { name: true } } },
    });

    return files.map((file: any) => ({
      id: file.id,
      name: file.fileName,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.sizeBytes,
      type: file.mimeType,
      url: `/media/${file.id}`,
      visibility: file.visibility,
      alt: file.alt,
      title: file.title,
      language: file.language,
      resourceType: file.resourceType,
      tags: file.tags,
      decorative: file.decorative,
      publishedAt: file.publishedAt,
      uploadedBy: file.uploader?.name ?? file.uploadedById ?? 'System/import',
      checksum: file.checksum,
      version: file.version,
      scanStatus: file.scanStatus,
      usageLocations: file.usageLocations,
      companyIds: file.companyIds,
      productIds: file.productIds,
      derivatives: file.derivatives,
      previousVersionId: file.previousVersionId,
      created_at: file.createdAt,
    }));
  }

  async listPublic(productId?: string) {
    const files = await this.prisma.mediaAsset.findMany({
      where: {
        visibility: 'PUBLIC',
        ...(productId ? { productIds: { has: productId } } : {}),
        publishedAt: { lte: new Date() },
        qualification: false,
        scanStatus: { in: this.safeScanStatuses() },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        title: true,
        language: true,
        resourceType: true,
        tags: true,
        publishedAt: true,
        version: true,
        productIds: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return files.map((file) => ({
      ...file,
      downloadUrl: `/media/${file.id}/download`,
    }));
  }

  async create(
    file: UploadedMediaFile,
    requestedVisibility: string | undefined,
    actor: JwtPayload,
    ip?: string,
  ) {
    const visibility = (
      requestedVisibility ?? 'PUBLIC'
    ).toUpperCase() as MediaVisibility;
    if (
      !['PUBLIC', 'REGISTERED', 'DEALER_ONLY', 'INTERNAL'].includes(visibility)
    ) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'invalid media visibility',
        400,
      );
    }
    if (!Buffer.isBuffer(file.buffer)) {
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'uploaded file buffer is missing',
        400,
      );
    }

    const security = await this.inspectFile(file);
    const duplicate = await this.prisma.mediaAsset.findFirst({
      where: {
        checksum: security.checksum,
        visibility,
        uploadedById: actor.sub,
        qualification: false,
        scanStatus: { in: this.safeScanStatuses() },
      },
    });
    if (duplicate)
      return {
        id: duplicate.id,
        fileName: duplicate.fileName,
        mimeType: duplicate.mimeType,
        size: duplicate.sizeBytes,
        visibility: duplicate.visibility,
        deduplicated: true,
      };
    await mkdir(this.storageRoot, { recursive: true });
    const extension = extname(String(file.originalname ?? '')).replace(
      /[^a-zA-Z0-9.]/g,
      '',
    );
    const key = `${randomUUID()}${extension}`;
    const storedPath = join(this.storageRoot, key);
    await writeFile(storedPath, file.buffer);
    let derivatives: Prisma.InputJsonArray = [];
    let media;
    try {
      derivatives = file.mimetype.startsWith('image/')
        ? await this.derive(file.buffer, key, visibility, security.scanStatus)
        : [];
      media = await this.prisma.mediaAsset.create({
        data: {
          key,
          fileName: file.originalname.slice(0, 160),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          visibility,
          uploadedById: actor.sub,
          ...security,
          derivatives,
        },
      });
    } catch (error) {
      await unlink(storedPath).catch(() => undefined);
      await this.removeDerived(this.derivativeIds(derivatives));
      throw error;
    }
    void this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'media.upload',
      entityType: 'mediaAsset',
      entityId: media.id,
      after: {
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        visibility,
      },
      ip,
    });

    return {
      id: media.id,
      name: media.fileName,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.sizeBytes,
      type: media.mimeType,
      url: `/media/${media.id}`,
      visibility: media.visibility,
    };
  }

  async createDealerAttachment(file: UploadedMediaFile) {
    const security = await this.inspectFile(file);
    await mkdir(this.storageRoot, { recursive: true });
    const extension = extname(String(file.originalname ?? '')).toLowerCase();
    const key = `${randomUUID()}${extension}`;
    const storedPath = join(this.storageRoot, key);
    await writeFile(storedPath, file.buffer);
    try {
      const media = await this.prisma.mediaAsset.create({
        data: {
          key,
          fileName: file.originalname.slice(0, 160),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          visibility: 'DEALER_ONLY',
          qualification: true,
          ...security,
        },
      });
      return {
        mediaId: media.id,
        attachmentToken: media.key,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        visibility: 'PRIVATE' as const,
      };
    } catch (error) {
      await unlink(storedPath).catch(() => undefined);
      throw error;
    }
  }

  async sign(id: string, expireSeconds = 60) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }
    if (!this.safeScanStatuses().includes(media.scanStatus))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'media awaiting security scan',
        403,
      );

    const safeExpire = Math.min(
      Math.max(Number.isFinite(expireSeconds) ? expireSeconds : 60, 1),
      86400,
    );
    const expires = Math.floor(Date.now() / 1000) + Math.floor(safeExpire);
    return {
      id: media.id,
      url: `/media/${media.id}/download?expires=${expires}&signature=${this.signature(media.id, expires)}`,
      expireSeconds: Math.floor(safeExpire),
      fileName: media.fileName,
      mimeType: media.mimeType,
    };
  }

  async open(
    id: string,
    expires?: string,
    signature?: string,
  ): Promise<StoredMedia> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }
    if (!this.safeScanStatuses().includes(media.scanStatus))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'media awaiting security scan',
        403,
      );
    if (
      (media.visibility !== 'PUBLIC' || media.publishedAt > new Date()) &&
      !this.validSignature(id, expires, signature)
    ) {
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'signed media URL required',
        403,
      );
    }

    return {
      stream: createReadStream(join(this.storageRoot, media.key)),
      fileName: media.fileName,
      mimeType: media.mimeType,
    };
  }

  async delete(id: string, actor?: JwtPayload, ip?: string) {
    const exists = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }
    const referenced = await this.prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { previousVersionId: id },
          { derivatives: { array_contains: [{ mediaId: id }] } },
        ],
      },
    });
    const [businessReference] = await this.prisma.$queryRaw<
      Array<{ used: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1 FROM "Product" p WHERE position(${id} in to_jsonb(p)::text) > 0
        UNION ALL SELECT 1 FROM "CmsPage" p WHERE position(${id} in to_jsonb(p)::text) > 0
        UNION ALL SELECT 1 FROM "DealerCompany" c WHERE position(${id} in c."profile"::text) > 0
        UNION ALL SELECT 1 FROM "CmsRevision" r WHERE position(${id} in r."snapshot"::text) > 0
        UNION ALL SELECT 1 FROM "RetailReturn" r WHERE position(${id} in COALESCE((to_jsonb(r)->'attachments')::text, '')) > 0
        UNION ALL SELECT 1 FROM "DealerApplication" a WHERE position(${id} in a."attachments"::text) > 0
        UNION ALL SELECT 1 FROM "DealerRfq" r WHERE ${id} = ANY(r."attachmentIds")
        UNION ALL SELECT 1 FROM "ContactMessage" c WHERE ${id} = ANY(c."attachments")
        UNION ALL SELECT 1 FROM "SiteSetting" s WHERE s."key" NOT LIKE 'media-cleanup:%' AND position(${id} in s."value"::text) > 0
      ) AS used`;
    if (exists.usageLocations.length || referenced || businessReference.used)
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'remove usage references before deleting',
        409,
      );
    await this.removeDerived(this.derivativeIds(exists.derivatives));
    await this.removeStored(exists.key);
    await this.prisma.mediaAsset.delete({ where: { id } });
    void this.audit.record({
      actorKind: actor ? 'STAFF' : 'ANON',
      actorStaffId: actor?.sub,
      action: actor ? 'media.delete' : 'media.cleanup.delete',
      entityType: 'mediaAsset',
      entityId: id,
      before: { fileName: exists.fileName, visibility: exists.visibility },
      ip,
    });
    return { ok: true };
  }

  async deleteUnreferencedQualifications(ids: string[], actor: JwtPayload) {
    const files = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...new Set(ids)] }, qualification: true },
    });
    const deleted: string[] = [],
      retained: string[] = [],
      queued: string[] = [];
    for (const file of files) {
      try {
        await this.delete(file.id, actor);
        deleted.push(file.id);
      } catch (error) {
        if (error instanceof BizException && error.getStatus() === 409)
          retained.push(file.id);
        else {
          await this.prisma.$transaction(async (tx) => {
            await tx.mediaAsset.updateMany({
              where: { id: file.id, qualification: true },
              data: {
                scanStatus: 'PENDING_DELETE',
                fileName: 'removed-qualification',
                title: '',
                alt: '',
                tags: [],
              },
            });
            const value = {
              mediaId: file.id,
              status: 'PENDING',
              attempts: 0,
              availableAt: new Date().toISOString(),
              lastError: 'FILE_CLEANUP_FAILED',
            };
            await tx.siteSetting.upsert({
              where: { key: `media-cleanup:${file.id}` },
              create: { key: `media-cleanup:${file.id}`, value },
              update: { value },
            });
          });
          queued.push(file.id);
        }
      }
    }
    return { deleted, retained, queued };
  }
  async cleanupJobs() {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'media-cleanup:' } },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => ({
      key: row.key,
      ...(row.value as Record<string, Prisma.JsonValue>),
      updatedAt: row.updatedAt,
    }));
  }
  async drainQualificationCleanup() {
    if (this.cleanupBusy) return;
    this.cleanupBusy = true;
    try {
      const rows = await this.prisma.siteSetting.findMany({
        where: { key: { startsWith: 'media-cleanup:' } },
        orderBy: { updatedAt: 'asc' },
        take: 25,
      });
      for (const row of rows) {
        const job = row.value as {
          mediaId: string;
          status: string;
          attempts: number;
          availableAt: string;
          lastError?: string;
        };
        if (!job.mediaId || new Date(job.availableAt).getTime() > Date.now())
          continue;
        const claimed = await this.prisma.siteSetting.updateMany({
          where: { key: row.key, updatedAt: row.updatedAt },
          data: {
            value: {
              ...job,
              status: 'RUNNING',
              availableAt: new Date(Date.now() + 120_000).toISOString(),
            },
          },
        });
        if (!claimed.count) continue;
        try {
          await this.delete(job.mediaId);
          await this.prisma.siteSetting.deleteMany({ where: { key: row.key } });
        } catch (error) {
          if (error instanceof BizException && error.getStatus() === 404) {
            await this.prisma.siteSetting.deleteMany({
              where: { key: row.key },
            });
            continue;
          }
          await this.prisma.siteSetting.update({
            where: { key: row.key },
            data: {
              value: {
                ...job,
                status: 'PENDING',
                attempts: job.attempts + 1,
                availableAt: new Date(
                  Date.now() +
                    Math.min(
                      86400_000,
                      60_000 * 2 ** Math.min(job.attempts, 10),
                    ),
                ).toISOString(),
                lastError:
                  error instanceof BizException && error.getStatus() === 409
                    ? 'FILE_STILL_REFERENCED'
                    : 'FILE_CLEANUP_FAILED',
              },
            },
          });
        }
      }
    } finally {
      this.cleanupBusy = false;
    }
  }

  async inspectFile(file: UploadedMediaFile) {
    const b = file.buffer;
    const valid =
      file.mimetype === 'application/pdf'
        ? b.subarray(0, 5).toString() === '%PDF-'
        : file.mimetype === 'image/png'
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.mimetype === 'image/jpeg'
            ? b[0] === 255 && b[1] === 216 && b[2] === 255
            : file.mimetype === 'image/webp'
              ? b.subarray(0, 4).toString() === 'RIFF' &&
                b.subarray(8, 12).toString() === 'WEBP'
              : file.mimetype === 'video/mp4'
                ? b.length >= 12 && b.subarray(4, 8).toString() === 'ftyp'
                : file.mimetype === 'video/webm'
                  ? b.length >= 8 &&
                    b
                      .subarray(0, 4)
                      .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
                    b.subarray(0, 4096).includes(Buffer.from('webm'))
                  : false;
    if (!valid || !b.length || b.length !== file.size)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'file contents do not match the declared format',
        422,
      );
    if (b.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'unsafe file rejected',
        422,
      );
    let scanStatus = 'SIGNATURE_CHECKED';
    if (process.env.MEDIA_SCAN_URL) {
      const response = await fetch(process.env.MEDIA_SCAN_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          ...(process.env.MEDIA_SCAN_TOKEN
            ? { authorization: `Bearer ${process.env.MEDIA_SCAN_TOKEN}` }
            : {}),
        },
        body: new Uint8Array(b),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'file scanner unavailable; retry upload',
          503,
        );
      const result = (await response.json()) as { clean?: boolean };
      if (result.clean !== true)
        throw new BizException(
          ERROR_CODES.VALIDATION,
          'file failed malware scan',
          422,
        );
      scanStatus = 'CLEAN';
    } else if (process.env.MEDIA_SCAN_REQUIRED === 'true')
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'required malware scanner is not configured',
        503,
      );
    return {
      checksum: createHash('sha256').update(b).digest('hex'),
      scanStatus,
    };
  }
  private async derive(
    buffer: Buffer,
    key: string,
    visibility: MediaVisibility,
    scanStatus: string,
  ): Promise<Prisma.InputJsonArray> {
    const results: Prisma.InputJsonValue[] = [];
    try {
      for (const width of [320, 768, 1440]) {
        const derivedKey = `${key}-${width}.webp`;
        const bytes = await sharp(buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        await writeFile(join(this.storageRoot, derivedKey), bytes);
        let asset;
        try {
          asset = await this.prisma.mediaAsset.create({
            data: {
              key: derivedKey,
              fileName: derivedKey,
              mimeType: 'image/webp',
              sizeBytes: bytes.length,
              visibility,
              scanStatus,
              checksum: createHash('sha256').update(bytes).digest('hex'),
            },
          });
        } catch (error) {
          await unlink(join(this.storageRoot, derivedKey)).catch(
            () => undefined,
          );
          throw error;
        }
        results.push({
          width,
          mediaId: asset.id,
          url: visibility === 'PUBLIC' ? `/media/${asset.id}/download` : null,
          sizeBytes: bytes.length,
        });
      }
    } catch (error) {
      await this.removeDerived(this.derivativeIds(results));
      throw error;
    }
    return results;
  }
  private async accessible(media: MediaAsset, actor: JwtPayload) {
    if (actor.kind === 'staff') {
      const staff = await this.prisma.staff.findUnique({
        where: { id: actor.sub },
        select: { status: true },
      });
      if (
        staff?.status === 'ACTIVE' &&
        (actor.roles?.includes('SUPER_ADMIN') ||
          actor.permissions?.includes('media:read'))
      )
        return true;
      return false;
    }
    if (media.publishedAt && media.publishedAt > new Date()) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { status: true },
    });
    if (user?.status !== 'ACTIVE') return false;
    if (media.visibility === 'PUBLIC' || media.visibility === 'REGISTERED')
      return true;
    if (
      media.visibility !== 'DEALER_ONLY' ||
      !actor.companyId ||
      media.qualification
    )
      return false;
    const member = await this.prisma.dealerMember.findUnique({
      where: {
        companyId_userId: { companyId: actor.companyId, userId: actor.sub },
      },
      include: { company: true },
    });
    if (!member?.active || member.company.status !== 'APPROVED') return false;
    if (media.companyIds.length && !media.companyIds.includes(member.companyId))
      return false;
    const variants = catalogVariantWhere(member.company.catalogPolicy);
    if (
      media.productIds.length &&
      (await this.prisma.product.count({
        where: {
          id: { in: media.productIds },
          ...catalogWhere(member.company.catalogPolicy, member.company.country),
          ...(Object.keys(variants).length
            ? { variants: { some: { status: true, ...variants } } }
            : {}),
        },
      })) !== media.productIds.length
    )
      return false;
    return true;
  }
  async downloads(actor: JwtPayload, productId?: string) {
    const files = await this.prisma.mediaAsset.findMany({
      where: {
        ...(productId ? { productIds: { has: productId } } : {}),
        qualification: false,
        visibility: { in: ['PUBLIC', 'REGISTERED', 'DEALER_ONLY'] },
        scanStatus: { in: this.safeScanStatuses() },
        publishedAt: { lte: new Date() },
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
    const allowed = [];
    for (const file of files)
      if (await this.accessible(file, actor))
        allowed.push({
          id: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          visibility: file.visibility,
          alt: file.alt,
          version: file.version,
          title: file.title,
          language: file.language,
          resourceType: file.resourceType,
          tags: file.tags,
          publishedAt: file.publishedAt,
          productIds: file.productIds,
        });
    return allowed;
  }
  async signFor(id: string, actor: JwtPayload, expireSeconds = 60) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media || !(await this.accessible(media, actor)))
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'file is not authorized for this account',
        403,
      );
    return this.sign(id, Math.min(expireSeconds, 300));
  }

  async rescan(id: string, actor: JwtPayload) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    if (media.scanStatus === 'PENDING_DELETE')
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'file is pending privacy cleanup',
        409,
      );
    const ids = [id, ...this.derivativeIds(media.derivatives)];
    await this.prisma.mediaAsset.updateMany({
      where: { id: { in: ids } },
      data: { scanStatus: 'SCANNING' },
    });
    try {
      const buffer = await readFile(join(this.storageRoot, media.key));
      const result = await this.inspectFile({
        buffer,
        originalname: media.fileName,
        mimetype: media.mimeType,
        size: media.sizeBytes,
      });
      await this.prisma.mediaAsset.update({ where: { id }, data: result });
      await this.prisma.mediaAsset.updateMany({
        where: { id: { in: ids.filter((value) => value !== id) } },
        data: { scanStatus: result.scanStatus },
      });
      await this.audit.record({
        actorKind: 'STAFF',
        actorStaffId: actor.sub,
        action: 'media.rescan',
        entityType: 'mediaAsset',
        entityId: id,
        after: { scanStatus: result.scanStatus },
      });
      return { id, ...result };
    } catch (error) {
      await this.prisma.mediaAsset.updateMany({
        where: { id: { in: ids } },
        data: { scanStatus: 'QUARANTINED' },
      });
      throw error;
    }
  }
  async metadata(id: string, data: MediaMetadataDto, actor: JwtPayload) {
    if (data.previousVersionId === id)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'version cannot reference itself',
        422,
      );
    const current = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!current)
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    if (
      current.previousVersionId &&
      data.previousVersionId &&
      current.previousVersionId !== data.previousVersionId
    )
      throw new BizException(
        ERROR_CODES.CONFLICT,
        'a saved version predecessor cannot be changed',
        409,
      );
    const previous = data.previousVersionId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: data.previousVersionId },
        })
      : null;
    if (data.previousVersionId && !previous)
      throw new BizException(
        ERROR_CODES.VALIDATION,
        'previous version not found',
        422,
      );
    if (previous) {
      const visited = new Set<string>([id]);
      let ancestor: MediaAsset | null = previous;
      while (ancestor) {
        if (visited.has(ancestor.id))
          throw new BizException(
            ERROR_CODES.CONFLICT,
            'media version cycle is not allowed',
            409,
          );
        visited.add(ancestor.id);
        ancestor = ancestor.previousVersionId
          ? await this.prisma.mediaAsset.findUnique({
              where: { id: ancestor.previousVersionId },
            })
          : null;
      }
    }
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...data,
        ...(data.publishedAt
          ? { publishedAt: new Date(data.publishedAt) }
          : {}),
        ...(previous ? { version: previous.version + 1 } : {}),
      },
    });
    // Derivatives inherit the same access grants as their original; no private thumbnail bypass.
    const derivatives = Array.isArray(updated.derivatives)
      ? (updated.derivatives as Array<{ mediaId?: string }>)
      : [];
    await this.prisma.mediaAsset.updateMany({
      where: {
        id: { in: derivatives.flatMap((d) => (d.mediaId ? [d.mediaId] : [])) },
      },
      data: {
        companyIds: data.companyIds,
        productIds: data.productIds,
        ...(data.publishedAt
          ? { publishedAt: new Date(data.publishedAt) }
          : {}),
        ...(data.decorative !== undefined
          ? { decorative: data.decorative }
          : {}),
        alt: data.alt,
      },
    });
    await this.audit.record({
      actorKind: 'STAFF',
      actorStaffId: actor.sub,
      action: 'media.metadata',
      entityType: 'mediaAsset',
      entityId: id,
      after: { alt: data.alt, version: updated.version },
    });
    return updated;
  }
  async companyAttachment(file: UploadedMediaFile, actor: JwtPayload) {
    if (actor.kind !== 'customer' || !actor.companyId)
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'dealer membership required',
        403,
      );
    const member = await this.prisma.dealerMember.findUnique({
      where: {
        companyId_userId: { companyId: actor.companyId, userId: actor.sub },
      },
      include: { company: true },
    });
    if (
      !member?.active ||
      member.role === 'VIEWER' ||
      member.company.status !== 'APPROVED'
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'purchasing member required',
        403,
      );
    const stored = await this.createDealerAttachment(file);
    await this.prisma.mediaAsset.update({
      where: { id: stored.mediaId },
      data: { qualification: false, companyIds: [actor.companyId] },
    });
    return { mediaId: stored.mediaId, fileName: stored.fileName };
  }
}
