import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Aggregates never return account identifiers. Revenue stays separated by currency. */
export async function operationMetrics(
  prisma: PrismaService,
  financial: boolean,
) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [products, content, search, sales, dealer, leads, vitals] =
    await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   WITH raw AS (SELECT * FROM "AnalyticsEvent" WHERE "createdAt">=${since}), e AS (
    SELECT raw.*,COALESCE(NULLIF(properties->>'session_id',''),id) AS visitor FROM raw WHERE name<>'request_quote' OR properties->>'product_id' IS NOT NULL
    UNION ALL SELECT raw.id,raw.name,raw.path,(raw.properties || jsonb_build_object('product_id',COALESCE(item->>'product_id',v."productId"))),raw."createdAt",COALESCE(NULLIF(raw.properties->>'session_id',''),raw.id)
    FROM raw CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(raw.properties->'items')='array' THEN raw.properties->'items' ELSE '[]'::jsonb END) item LEFT JOIN "ProductVariant" v ON v.sku=item->>'sku' WHERE raw.name='request_quote' AND COALESCE(item->>'product_id',v."productId") IS NOT NULL)
   SELECT COALESCE(NULLIF(properties->>'product_id',''),path) AS product,
    COUNT(DISTINCT visitor) FILTER(WHERE name='view_product')::int AS views,
    COUNT(DISTINCT visitor) FILTER(WHERE name='add_to_cart')::int AS "addToCart",
    COUNT(DISTINCT visitor) FILTER(WHERE name='purchase')::int AS purchases,
    COUNT(DISTINCT visitor) FILTER(WHERE name='request_quote')::int AS inquiries,
    COUNT(*) FILTER(WHERE name='search_click')::int AS "searchClicks",
    COUNT(*) FILTER(WHERE name='view_product' AND properties->>'availability' IN ('OUT_OF_STOCK','UNAVAILABLE'))::int AS "outOfStockViews"
   FROM e WHERE name IN ('view_product','add_to_cart','purchase','request_quote','search_click') GROUP BY product ORDER BY views DESC LIMIT 100`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   WITH e AS (SELECT * FROM "AnalyticsEvent" WHERE "createdAt">=${since})
   SELECT path,COUNT(*) FILTER(WHERE name='view_content')::int AS reads,
    COUNT(*) FILTER(WHERE name='cta_click' AND properties->>'target' LIKE '%/products/%')::int AS "productClicks",
    COUNT(*) FILTER(WHERE name='download_asset')::int AS downloads,
    COUNT(DISTINCT properties->>'session_id') FILTER(WHERE name='view_content' AND EXISTS(SELECT 1 FROM e follow WHERE follow.name='purchase' AND follow.properties->>'session_id'=e.properties->>'session_id' AND follow."createdAt">=e."createdAt"))::int AS "assistedSessions"
   FROM e WHERE path LIKE '%/content/%' OR path LIKE '%/play-learn%' GROUP BY path ORDER BY reads DESC LIMIT 100`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   WITH e AS (SELECT * FROM "AnalyticsEvent" WHERE "createdAt">=${since})
   SELECT properties->>'query' AS query,COUNT(*) FILTER(WHERE name='search')::int AS searches,
    COUNT(*) FILTER(WHERE name='search' AND properties->>'results_count'='0')::int AS "noResults",
    COUNT(*) FILTER(WHERE name='search_click')::int AS clicks,
    COUNT(DISTINCT properties->>'session_id') FILTER(WHERE name='search' AND EXISTS(SELECT 1 FROM e follow WHERE follow.name='purchase' AND follow.properties->>'session_id'=e.properties->>'session_id' AND follow."createdAt">=e."createdAt"))::int AS "convertedSessions"
   FROM e WHERE name IN ('search','search_click') GROUP BY query ORDER BY searches DESC LIMIT 100`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   SELECT 'B2C' AS channel,market,currency,COUNT(*)::int AS orders,
    COUNT(*) FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED'))::int AS "paidOrders",
    COALESCE(SUM("totalCents") FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')),0)::float8 AS "paidCents",
    COALESCE(ROUND(AVG("totalCents") FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED'))),0)::float8 AS "averagePaidCents",
    (SELECT COALESCE(SUM(r."amountCents"),0)::float8 FROM "RetailRefund" r JOIN "Order" ro ON ro.id=r."orderId" WHERE r.status='SUCCEEDED' AND r."createdAt">=${since} AND ro.currency=o.currency AND ro.market=o.market) AS "refundedCents"
   FROM "Order" o WHERE "createdAt">=${since} GROUP BY market,currency
   UNION ALL
   SELECT 'B2B',market,currency,COUNT(*)::int,COUNT(*) FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED'))::int,
    COALESCE(SUM("totalCents") FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')),0)::float8,
    COALESCE(ROUND(AVG("totalCents") FILTER(WHERE "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED'))),0)::float8,
    (SELECT COALESCE(SUM(r."amountCents"),0)::float8 FROM "PurchaseOrderRefund" r JOIN "PurchaseOrder" ro ON ro.id=r."orderId" WHERE r.status='SUCCEEDED' AND r."completedAt">=${since} AND ro.currency=o.currency AND ro.market=o.market)
   FROM "PurchaseOrder" o WHERE "createdAt">=${since} GROUP BY market,currency`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   SELECT COUNT(*)::int AS applications,COUNT(*) FILTER(WHERE status='APPROVED')::int AS approved,
    AVG(EXTRACT(EPOCH FROM ("reviewedAt"-"createdAt"))/3600)::float8 AS "averageReviewHours",
    (SELECT COUNT(DISTINCT "companyId")::int FROM "PurchaseOrder" WHERE "createdAt">=${since}) AS "orderingCompanies",
    (SELECT COUNT(*)::int FROM(SELECT "companyId" FROM "PurchaseOrder" WHERE "createdAt">=${since} GROUP BY "companyId" HAVING COUNT(*)>1) r) AS "repeatCompanies"
   FROM "DealerApplication" WHERE "createdAt">=${since}`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   SELECT source,COUNT(*)::int AS requests,COUNT(*) FILTER(WHERE status IN ('RESOLVED','CLOSED'))::int AS resolved,
    AVG(EXTRACT(EPOCH FROM ((SELECT MIN((h->>'at')::timestamptz) FROM jsonb_array_elements(history) h WHERE h->>'action'='reply')-"createdAt"))/3600)::float8 AS "averageResponseHours"
   FROM "ContactMessage" WHERE "createdAt">=${since} GROUP BY source`),
      prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
   WITH samples AS (SELECT DISTINCT ON(properties->>'metric_id') properties,path FROM "AnalyticsEvent" WHERE name='web_vital' AND "createdAt">=${since} AND properties->>'metric_name' IN ('LCP','INP','CLS','FCP','TTFB') AND jsonb_typeof(properties->'metric_value')='number' ORDER BY properties->>'metric_id',"createdAt" DESC)
   SELECT properties->>'metric_name' AS metric,properties->>'device' AS device,COUNT(*)::int AS samples,percentile_cont(0.75) WITHIN GROUP(ORDER BY (properties->>'metric_value')::float8) AS p75 FROM samples GROUP BY metric,device`),
    ]);
  const rate = (n: unknown, d: unknown) =>
    Number(d) > 0 ? Math.round((Number(n) / Number(d)) * 10000) / 100 : null;
  return {
    vitals,
    products: products.map((row) => ({
      ...row,
      addToCartRate: rate(row.addToCart, row.views),
      purchaseRate: rate(row.purchases, row.views),
      inquiryRate: rate(row.inquiries, row.views),
    })),
    content,
    search,
    sales: sales.map(
      ({ paidCents, averagePaidCents, refundedCents, ...row }) => ({
        ...row,
        ...(financial
          ? {
              paidCents,
              averagePaidCents,
              refundedCents,
              refundRate: rate(refundedCents, paidCents),
            }
          : {}),
      }),
    ),
    dealer: dealer.map((row) => ({
      ...row,
      approvalRate: rate(row.approved, row.applications),
      repeatRate: rate(row.repeatCompanies, row.orderingCompanies),
    })),
    lead: leads.map((row) => ({
      ...row,
      resolutionRate: rate(row.resolved, row.requests),
    })),
  };
}
