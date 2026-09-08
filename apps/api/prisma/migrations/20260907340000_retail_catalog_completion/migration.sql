ALTER TABLE "ProductCategory" ADD COLUMN "description" TEXT, ADD COLUMN "coverImage" JSONB, ADD COLUMN "seo" JSONB;
ALTER TABLE "Product" ADD COLUMN "associations" JSONB NOT NULL DEFAULT '[]';
