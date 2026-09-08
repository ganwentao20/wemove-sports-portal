ALTER TABLE "User" ADD COLUMN "displayName" TEXT, ADD COLUMN "country" TEXT,
ADD COLUMN "productUpdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "termsVersion" TEXT, ADD COLUMN "privacyVersion" TEXT,
ADD COLUMN "policiesAgreedAt" TIMESTAMP(3), ADD COLUMN "policiesIp" TEXT;
