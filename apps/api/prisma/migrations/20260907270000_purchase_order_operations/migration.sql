ALTER TABLE "PurchaseOrder" ADD COLUMN "inventoryReserved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PurchaseOrder" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "adjustments" JSONB NOT NULL DEFAULT '[]';
