-- AlterTable
ALTER TABLE "DealerApplication" ADD COLUMN     "applicantId" TEXT;

-- CreateIndex
CREATE INDEX "DealerApplication_applicantId_status_idx" ON "DealerApplication"("applicantId", "status");

-- AddForeignKey
ALTER TABLE "DealerApplication" ADD CONSTRAINT "DealerApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
