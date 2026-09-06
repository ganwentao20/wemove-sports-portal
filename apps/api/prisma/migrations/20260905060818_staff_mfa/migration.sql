-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "mfaConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;
