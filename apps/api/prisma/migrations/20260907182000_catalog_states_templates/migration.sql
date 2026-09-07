ALTER TYPE "ProductStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "ProductStatus" ADD VALUE 'HIDDEN';
ALTER TABLE "ProductCategory" ADD COLUMN "attributeTemplate" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "filterableFields" TEXT[] NOT NULL DEFAULT ARRAY['category','age','scene','skill','stock','price']::TEXT[];
