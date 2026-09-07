ALTER TYPE "ContactStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "ContactStatus" ADD VALUE IF NOT EXISTS 'WAITING_CUSTOMER';
ALTER TABLE "ContactMessage" ADD COLUMN "assignedTeam" TEXT;
CREATE INDEX "ContactMessage_source_priority_createdAt_idx" ON "ContactMessage" ("source", "priority", "createdAt");
