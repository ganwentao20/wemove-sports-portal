-- Preserve existing rows while making company identity mandatory for all new applications.
ALTER TABLE "DealerApplication"
  ADD COLUMN "companyName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "legalRegNo" TEXT NOT NULL DEFAULT '';

ALTER TABLE "DealerApplication"
  ALTER COLUMN "companyName" DROP DEFAULT,
  ALTER COLUMN "legalRegNo" DROP DEFAULT;
