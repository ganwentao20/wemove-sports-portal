import { Controller, Get, Header } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('site/cache-version')
export class CacheVersionController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Header('Cache-Control', 'no-store') async version() {
    // Snapshot visibility changes when a write commits. Unlike a shared trigger
    // row this adds no lock to concurrent stock reservations or CMS transactions.
    // The reached schedule boundary also invalidates cached scheduled content
    // when no write occurs at its publish/unpublish time.
    const [row] = await this.prisma.$queryRaw<
      Array<{ snapshot: string; boundary: Date | null }>
    >`
   SELECT pg_current_snapshot()::text AS snapshot,
    (SELECT max(t) FROM (
      SELECT "publishAt" AS t FROM "Product" WHERE "publishAt"<=CURRENT_TIMESTAMP
      UNION ALL SELECT "unpublishAt" FROM "Product" WHERE "unpublishAt"<=CURRENT_TIMESTAMP
      UNION ALL SELECT "publishAt" FROM "CmsPage" WHERE "publishAt"<=CURRENT_TIMESTAMP
      UNION ALL SELECT "unpublishAt" FROM "CmsPage" WHERE "unpublishAt"<=CURRENT_TIMESTAMP
      UNION ALL SELECT "publishedAt" FROM "MediaAsset" WHERE "publishedAt"<=CURRENT_TIMESTAMP
      UNION ALL SELECT dates.value::timestamptz FROM "CmsPage" c
       CROSS JOIN LATERAL (SELECT c.sections AS sections UNION ALL SELECT translation->'sections' FROM jsonb_each(c.translations) AS translated(language,translation) WHERE jsonb_typeof(translation->'sections')='array') content
       CROSS JOIN LATERAL jsonb_array_elements(content.sections) block
       CROSS JOIN LATERAL (VALUES (coalesce(block->'props'->>'publishAt',block->>'publishAt')),(coalesce(block->'props'->>'unpublishAt',block->>'unpublishAt'))) dates(value)
       WHERE dates.value IS NOT NULL AND dates.value::timestamptz<=CURRENT_TIMESTAMP
    ) boundaries) AS boundary`;
    return {
      revision: createHash('sha256')
        .update(row.snapshot + '|' + (row.boundary?.toISOString() ?? ''))
        .digest('hex'),
    };
  }
}
