-- Existing members must explicitly accept; never backfill consent from account creation.
ALTER TABLE "DealerMember" ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsAcceptedIp" TEXT;
