import { RetentionService } from './retention.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

it('honors configured analytics retention without deleting recent events or security audits', async () => {
  const now = new Date('2026-09-07T12:00:00Z');
  const events = [
    { at: new Date('2026-08-01T12:00:00Z') },
    { at: new Date('2026-09-06T12:00:00Z') },
  ];
  const deleteAudits = vi.fn(() => {
    throw new Error('Security audit records must be retained');
  });
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValue([]),
    siteSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: { retentionDays: 14 } }),
    },
    analyticsEvent: {
      deleteMany: vi.fn(
        async ({ where }: { where: { createdAt: { lt: Date } } }) => ({
          count: events.filter((item) => item.at < where.createdAt.lt).length,
        }),
      ),
    },
    staffLoginChallenge: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    authenticationSession: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { deleteMany: deleteAudits },
    userToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    $transaction: (work: (value: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  expect(await new RetentionService(prisma).run(now)).toMatchObject({
    retentionDays: 14,
    analytics: 1,
  });
  expect(deleteAudits).not.toHaveBeenCalled();
  tx.$queryRaw.mockResolvedValue([{ locked: false }]);
  expect(await new RetentionService(prisma).run(now)).toBeNull();
  expect(tx.analyticsEvent.deleteMany).toHaveBeenCalledTimes(1);
});
