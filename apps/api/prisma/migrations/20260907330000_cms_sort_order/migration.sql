ALTER TABLE "CmsPage" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "CmsPage_kind_sortOrder_idx" ON "CmsPage"("kind", "sortOrder");
