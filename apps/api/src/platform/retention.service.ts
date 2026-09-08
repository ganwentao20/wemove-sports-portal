import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: ReturnType<typeof setInterval>;
  private startup?: ReturnType<typeof setTimeout>;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    if (
      process.env.RETENTION_WORKER === 'false' ||
      process.env.NODE_ENV === 'test' ||
      process.env.E2E_DB === '1'
    )
      return;
    this.startup = setTimeout(() => {
      void this.scheduled();
    }, 30000);
    this.startup.unref();
    this.timer = setInterval(() => {
      void this.scheduled();
    }, 86400_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    clearTimeout(this.startup);
    clearInterval(this.timer);
  }
  private async scheduled() {
    try {
      const result = await this.run();
      if (result)
        this.logger.log(`Retention cleanup: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(
        'Retention cleanup failed',
        error instanceof Error ? error.message : undefined,
      );
    }
  }
  async run(now = new Date()) {
    return this.prisma.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(691927100) AS locked`;
        if (!lock.locked) return null;
        const tracking = await tx.siteSetting.findUnique({
          where: { key: 'tracking' },
        });
        const configured = (tracking?.value as Record<string, unknown> | null)
          ?.retentionDays;
        const days = Number.isInteger(configured)
          ? Math.max(1, Math.min(365, Number(configured)))
          : 90;
        const analytics = await tx.analyticsEvent.deleteMany({
          where: {
            createdAt: { lt: new Date(now.getTime() - days * 86400_000) },
          },
        });
        // Security audit records and privacy work items are deliberately not removed
        // by the anonymous analytics retention preference.
        const challenges = await tx.staffLoginChallenge.deleteMany({
          where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } },
        });
        const sessions = await tx.authenticationSession.deleteMany({
          where: {
            expiresAt: { lt: new Date(now.getTime() - 30 * 86400_000) },
          },
        });
        const tokens = await tx.userToken.deleteMany({
          where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } },
        });
        // Unsubmitted private return images expire with their 24-hour upload capability.
        // Submitted evidence remains part of the commercial service record.
        const abandoned = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT m.id FROM "MediaAsset" m WHERE m."resourceType"='RETURN_EVIDENCE' AND m."scanStatus"<>'PENDING_DELETE' AND m."createdAt"<${new Date(now.getTime() - 86400_000)} AND NOT EXISTS (SELECT 1 FROM "RetailReturn" r WHERE r.attachments @> jsonb_build_array(jsonb_build_object('mediaId',m.id))) ORDER BY m."createdAt" LIMIT 100 FOR UPDATE OF m SKIP LOCKED`;
        for (const file of abandoned) {
          await tx.mediaAsset.update({
            where: { id: file.id },
            data: {
              scanStatus: 'PENDING_DELETE',
              usageLocations: [],
              fileName: 'expired-return-image',
              title: '',
              alt: '',
              tags: [],
            },
          });
          const value = {
            mediaId: file.id,
            status: 'PENDING',
            attempts: 0,
            availableAt: now.toISOString(),
            lastError: null,
          };
          await tx.siteSetting.upsert({
            where: { key: `media-cleanup:${file.id}` },
            create: { key: `media-cleanup:${file.id}`, value },
            update: { value },
          });
        }
        return {
          analytics: analytics.count,
          retentionDays: days,
          challenges: challenges.count,
          sessions: sessions.count,
          tokens: tokens.count,
          returnImagesQueued: abandoned.length,
        };
      },
      { timeout: 30000 },
    );
  }
}
