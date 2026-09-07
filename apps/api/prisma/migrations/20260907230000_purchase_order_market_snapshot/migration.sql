ALTER TABLE "PurchaseOrder" ADD COLUMN "market" TEXT;
UPDATE "PurchaseOrder" AS po SET "market" = company."country"
FROM "DealerCompany" AS company WHERE company."id" = po."companyId";
UPDATE "PurchaseOrder" SET "market" = 'US' WHERE "market" IS NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "market" SET DEFAULT 'US';
ALTER TABLE "PurchaseOrder" ALTER COLUMN "market" SET NOT NULL;
