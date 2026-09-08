import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedCatalogLocales } from './seed-catalog-locales.ts';

const prisma = new PrismaClient();
try {
  const rows = await seedCatalogLocales(prisma);
  for (const row of rows)
    console.log(
      `[catalog-locales] ${row.slug}: ${row.updated ? 'updated' : 'unchanged'} (${row.languages.join(', ')})`,
    );
} catch (error) {
  console.error('Catalog locale seed failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
