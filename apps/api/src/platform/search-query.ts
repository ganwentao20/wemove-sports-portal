import { Prisma } from '@prisma/client';
/** All source filtering and pagination occur in PostgreSQL, without a truncated candidate pool. */
export function searchQuery(
  terms: string[],
  locale: string,
  market: string,
  type: string,
  page: number,
  hideUntranslated = false,
  suggest = false,
) {
  const values = Prisma.join(
    (terms.length ? terms : ['']).map((term) => Prisma.sql`(${term})`),
  );
  const productTranslation = Prisma.sql`(${locale}<>'en' AND ${locale} ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
 AND p.specifications->'translations'->${locale}->>'status'='PUBLISHED'
 AND NOT EXISTS (SELECT 1 FROM (VALUES ('name'),('summary'),('description'),('ageGuidance'),('playGuide')) AS fields(key)
  WHERE (key IN ('name','summary') OR coalesce(to_jsonb(p)->>key,'')<>'')
  AND (jsonb_typeof(p.specifications->'translations'->${locale}->key) IS DISTINCT FROM 'string' OR length(trim(coalesce(p.specifications->'translations'->${locale}->>key,'')))=0))
 AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(p.specifications)='object' THEN p.specifications ELSE '{}'::jsonb END) AS spec(key,value)
  WHERE key<>'translations' AND jsonb_typeof(value) IN ('string','number','boolean')
  AND (jsonb_typeof(p.specifications->'translations'->${locale}->'specifications'->key->'label') IS DISTINCT FROM 'string'
   OR length(trim(coalesce(p.specifications->'translations'->${locale}->'specifications'->key->>'label','')))=0
   OR coalesce(jsonb_typeof(p.specifications->'translations'->${locale}->'specifications'->key->'value'),'null') NOT IN ('string','number','boolean')
   OR (jsonb_typeof(p.specifications->'translations'->${locale}->'specifications'->key->'value')='string' AND length(trim(coalesce(p.specifications->'translations'->${locale}->'specifications'->key->>'value','')))=0)))
 AND (jsonb_array_length(CASE WHEN jsonb_typeof(p."productFaq")='array' THEN p."productFaq" ELSE '[]'::jsonb END)=0 OR
  (jsonb_array_length(CASE WHEN jsonb_typeof(p.specifications->'translations'->${locale}->'productFaq')='array' THEN p.specifications->'translations'->${locale}->'productFaq' ELSE '[]'::jsonb END)=jsonb_array_length(CASE WHEN jsonb_typeof(p."productFaq")='array' THEN p."productFaq" ELSE '[]'::jsonb END)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.specifications->'translations'->${locale}->'productFaq')='array' THEN p.specifications->'translations'->${locale}->'productFaq' ELSE '[]'::jsonb END) AS faq
    WHERE jsonb_typeof(faq->'question') IS DISTINCT FROM 'string' OR length(trim(coalesce(faq->>'question','')))=0 OR jsonb_typeof(faq->'answer') IS DISTINCT FROM 'string' OR length(trim(coalesce(faq->>'answer','')))=0))))`;
  const pageTranslation = Prisma.sql`(c.translations->${locale}->>'status'='PUBLISHED' AND length(trim(coalesce(c.translations->${locale}->>'title','')))>0 AND jsonb_typeof(c.translations->${locale}->'sections')='array')`;
  const sections = Prisma.sql`coalesce((SELECT jsonb_agg(block) FROM jsonb_array_elements(CASE WHEN ${pageTranslation} THEN c.translations->${locale}->'sections' ELSE c.sections END) block WHERE coalesce(block->'props'->>'enabled',block->>'enabled','true')<>'false' AND (coalesce(block->'props'->>'publishAt',block->>'publishAt') IS NULL OR coalesce(block->'props'->>'publishAt',block->>'publishAt')::timestamptz<=now()) AND (coalesce(block->'props'->>'unpublishAt',block->>'unpublishAt') IS NULL OR coalesce(block->'props'->>'unpublishAt',block->>'unpublishAt')::timestamptz>now())),'[]'::jsonb)`;
  const scanStatuses = Prisma.join(
    process.env.MEDIA_SCAN_REQUIRED === 'true'
      ? ['CLEAN']
      : ['CLEAN', 'SIGNATURE_CHECKED', 'LEGACY_UNSCANNED'],
  );
  return Prisma.sql`
 WITH terms(term) AS (VALUES ${values}), docs AS (
 SELECT p.id,'PRODUCT'::text AS type,
   CASE WHEN ${productTranslation} THEN p.specifications->'translations'->${locale}->>'name' ELSE p.name END AS title,
   coalesce(CASE WHEN ${productTranslation} THEN p.specifications->'translations'->${locale}->>'summary' ELSE p.summary END,'') AS summary, coalesce(CASE WHEN ${productTranslation} THEN p.specifications->'translations'->${locale}->>'description' ELSE p.description END,'') || ' ' || coalesce(array_to_string(p.tags,' '),'') || ' ' || coalesce(array_to_string(p.scenes,' '),'') || ' ' || coalesce(array_to_string(p.skills,' '),'') AS body,
   CASE WHEN ${productTranslation} THEN ${locale} ELSE 'en' END AS locale, '/products/' || p.slug AS url,coalesce((SELECT string_agg(v.sku,' ') FROM "ProductVariant" v WHERE v."productId"=p.id AND v.status=true),'') AS sku,coalesce((SELECT cat.name || ' ' || cat.code FROM "ProductCategory" cat WHERE cat.id=p."categoryId" AND cat.active),'') AS category
 FROM "Product" p WHERE (p.status='ACTIVE' OR p.status='SCHEDULED' AND p."publishAt" IS NOT NULL) AND (NOT ${hideUntranslated} OR ${locale}='en' OR ${productTranslation}) AND (cardinality(p.markets)=0 OR ${market}=ANY(p.markets)) AND (p."publishAt" IS NULL OR p."publishAt"<=now()) AND (p."unpublishAt" IS NULL OR p."unpublishAt">now())
 UNION ALL
 SELECT c.id,CASE WHEN c.kind='FAQ' OR c.slug LIKE '%faq%' THEN 'FAQ' ELSE 'ARTICLE' END,
   CASE WHEN ${pageTranslation} THEN c.translations->${locale}->>'title' ELSE c.title END,
   coalesce(jsonb_path_query_array(${sections},'$[*].props.text')::text,''),
   ${sections}::text, CASE WHEN ${pageTranslation} THEN ${locale} ELSE c.locale END, '/content/' || c.slug,'',coalesce(c.category,'')
 FROM "CmsPage" c WHERE (NOT ${hideUntranslated} OR c.locale=${locale} OR ${pageTranslation}) AND (c.kind IN ('ARTICLE','FAQ') OR c.slug LIKE '%article%' OR c.slug LIKE '%faq%') AND (c.status='PUBLISHED' OR c.status='SCHEDULED' AND c."publishAt"<=now()) AND (c.market='ALL' OR c.market=${market}) AND (c."publishAt" IS NULL OR c."publishAt"<=now()) AND (c."unpublishAt" IS NULL OR c."unpublishAt">now())
 UNION ALL
 SELECT m.id,'DOWNLOAD',coalesce(nullif(trim(m.title),''),m."fileName"),m."fileName",m.alt || ' ' || array_to_string(m.tags,' ') || ' ' || m."resourceType",m.language,'/support/downloads?asset=' || m.id,'','' FROM "MediaAsset" m WHERE m.visibility='PUBLIC' AND (m.language=${locale} OR split_part(m.language,'-',1)=${locale} OR NOT ${hideUntranslated} AND m.language='en') AND m."publishedAt"<=now() AND m.qualification=false AND m."scanStatus" IN (${scanStatuses})
 ), ranked AS (
 SELECT d.*,max(CASE WHEN lower(d.title)=t.term OR lower(d.sku)=t.term THEN 100 ELSE 0 END + CASE WHEN lower(d.title) LIKE '%' || t.term || '%' OR lower(d.sku) LIKE '%' || t.term || '%' THEN 50 ELSE 0 END + CASE WHEN lower(d.category) LIKE '%' || t.term || '%' THEN 25 ELSE 0 END + 20*ts_rank(to_tsvector('english',d.title || ' ' || d.sku || ' ' || d.category || ' ' || d.summary || ' ' || d.body),plainto_tsquery('english',t.term)) + 15*similarity(lower(d.title),t.term) + CASE WHEN lower(d.body || ' ' || d.summary) LIKE '%' || t.term || '%' THEN 5 ELSE 0 END) AS score
 FROM docs d CROSS JOIN terms t
 WHERE (${type}='ALL' OR d.type=${type}) AND (${suggest} OR t.term='' OR lower(d.title || ' ' || d.sku || ' ' || d.category || ' ' || d.summary || ' ' || d.body) LIKE '%' || t.term || '%' OR to_tsvector('english',d.title || ' ' || d.sku || ' ' || d.category || ' ' || d.summary || ' ' || d.body) @@ plainto_tsquery('english',t.term) OR (length(t.term)>=4 AND similarity(lower(d.title),t.term)>0.25))
 GROUP BY d.id,d.type,d.title,d.summary,d.body,d.locale,d.url,d.sku,d.category
 ), page AS (SELECT id,type,title,left(summary,500) AS summary,locale,url,score FROM ranked ORDER BY score DESC,title,id LIMIT 20 OFFSET ${(page - 1) * 20})
 SELECT (SELECT count(*)::int FROM ranked) AS total,coalesce((SELECT jsonb_agg(page) FROM page),'[]'::jsonb) AS items`;
}
