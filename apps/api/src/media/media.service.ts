import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizException, ERROR_CODES } from '../common/errors.js';

type MediaVisibility = 'PUBLIC' | 'DEALER_ONLY' | 'INTERNAL';
type StoredMedia = {
  stream: ReturnType<typeof createReadStream>;
  fileName: string;
  mimeType: string;
};

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly storageRoot = join(process.cwd(), 'media_private');

  private signingSecret() {
    return process.env.MEDIA_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev_only_change_me_media';
  }

  private signature(id: string, expires: number) {
    return createHmac('sha256', this.signingSecret())
      .update(`${id}:${expires}`)
      .digest('hex');
  }

  private validSignature(id: string, expires: string | undefined, signature: string | undefined) {
    if (!expires || !signature) return false;
    const expiresAt = Number(expires);
    if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.signature(id, expiresAt), 'utf8');
    const actual = Buffer.from(signature, 'utf8');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async list() {
    const files = await this.prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
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
      created_at: file.createdAt,
    }));
  }

  async create(file: any, requestedVisibility?: string) {
    const visibility = (requestedVisibility ?? 'PUBLIC').toUpperCase() as MediaVisibility;
    if (!['PUBLIC', 'DEALER_ONLY', 'INTERNAL'].includes(visibility)) {
      throw new BizException(ERROR_CODES.VALIDATION, 'invalid media visibility', 400);
    }
    if (!Buffer.isBuffer(file.buffer)) {
      throw new BizException(ERROR_CODES.VALIDATION, 'uploaded file buffer is missing', 400);
    }

    await mkdir(this.storageRoot, { recursive: true });
    const extension = extname(String(file.originalname ?? '')).replace(/[^a-zA-Z0-9.]/g, '');
    const key = `${randomUUID()}${extension}`;
    await writeFile(join(this.storageRoot, key), file.buffer);
    const media = await this.prisma.mediaAsset.create({
      data: {
        key,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size || 0,
        visibility,
      },
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

  async sign(id: string, expireSeconds = 60) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }

    const safeExpire = Math.min(Math.max(Number.isFinite(expireSeconds) ? expireSeconds : 60, 1), 86400);
    const expires = Math.floor(Date.now() / 1000) + Math.floor(safeExpire);
    return {
      id: media.id,
      url: `/media/${media.id}/download?expires=${expires}&signature=${this.signature(media.id, expires)}`,
      expireSeconds: Math.floor(safeExpire),
      fileName: media.fileName,
      mimeType: media.mimeType,
    };
  }

  async open(id: string, expires?: string, signature?: string): Promise<StoredMedia> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }
    if (media.visibility !== 'PUBLIC' && !this.validSignature(id, expires, signature)) {
      throw new BizException(ERROR_CODES.FORBIDDEN, 'signed media URL required', 403);
    }

    return {
      stream: createReadStream(join(this.storageRoot, media.key)),
      fileName: media.fileName,
      mimeType: media.mimeType,
    };
  }

  async delete(id: string) {
    const exists = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!exists) {
      throw new BizException(ERROR_CODES.NOT_FOUND, 'media not found', 404);
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    await unlink(join(this.storageRoot, exists.key)).catch(() => undefined);
    return { ok: true };
  }
}
