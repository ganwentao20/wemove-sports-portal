CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_search_english_idx" ON "Product" USING GIN (to_tsvector('english', coalesce("name",'') || ' ' || coalesce("summary",'') || ' ' || coalesce("description",'')));
CREATE INDEX "CmsPage_title_trgm_idx" ON "CmsPage" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "MediaAsset_fileName_trgm_idx" ON "MediaAsset" USING GIN ("fileName" gin_trgm_ops);
