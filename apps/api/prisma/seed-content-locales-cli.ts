import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedContentLocales } from './seed-content-locales.ts';
const prisma = new PrismaClient();
try {
  for (const result of await seedContentLocales(prisma))
    console.log(
      `[content-locales] ${result.slug}: ${result.updated ? 'updated' : 'unchanged'}`,
    );
} catch {
  console.error('Content locale update failed. Check database connectivity.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
