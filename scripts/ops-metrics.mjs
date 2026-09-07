import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
let cache = "";
let expires = 0;
let pending;
async function collect() {
  const rows = await prisma.$queryRawUnsafe(`SELECT
    (SELECT count(*) FROM "NotificationOutbox" WHERE status IN ('PENDING','SENDING'))::float AS queue_pending,
    (SELECT count(*) FROM "NotificationOutbox" WHERE status = 'DEAD')::float AS queue_dead,
    (SELECT coalesce(extract(epoch from now()-min("createdAt")),0) FROM "NotificationOutbox" WHERE status IN ('PENDING','SENDING'))::float AS queue_oldest_seconds,
    (SELECT count(*) FROM "Order" WHERE status = 'PENDING' AND "reservationExpiresAt" < now())::float AS expired_order_reservations,
    (SELECT count(*) FROM "Stock" WHERE available <= "lowThreshold")::float AS low_stock_variants,
    (SELECT count(*) FROM "Stock" WHERE "syncError" IS NOT NULL)::float AS inventory_sync_errors,
    (SELECT count(*) FROM "RetailPayment" WHERE status = 'FAILED' AND "createdAt" > now()-interval '1 hour')::float AS payment_failures_hour,
    (SELECT count(*) FROM "RetailPayment" WHERE "createdAt" > now()-interval '1 hour')::float AS payments_hour,
    (SELECT count(*) FROM "AnalyticsEvent" WHERE name = 'search' AND properties->>'results_count' = '0' AND "createdAt" > now()-interval '1 hour')::float AS search_no_results_hour,
    (SELECT count(*) FROM "AnalyticsEvent" WHERE name = 'client_error' AND "createdAt" > now()-interval '1 hour')::float AS frontend_errors_hour,
    (SELECT failed_count::float FROM pg_stat_archiver) AS wal_archive_failures_total,
    (SELECT count(*)::float FROM pg_stat_activity WHERE datname=current_database()) AS database_connections,
    pg_database_size(current_database())::float AS database_bytes`);
  let backupInfo = [];
  try {
    backupInfo =
      JSON.parse(
        await readFile("/var/lib/pgbackrest-status/status.json", "utf8"),
      )?.[0]?.backup || [];
  } catch {
    /* Missing status intentionally alerts until a successful backup. */
  }
  const backupMetrics = (process.env.BACKUP_REPOSITORIES || "1")
    .split(",")
    .filter((repo) => /^[12]$/.test(repo))
    .map((repo) => {
      const entries = backupInfo.filter(
        (entry) => Number(entry.database?.["repo-key"] ?? 1) === Number(repo),
      );
      const latest = Math.max(
        0,
        ...entries.map((entry) => Number(entry.timestamp?.stop || 0)),
      );
      const full = Math.max(
        0,
        ...entries
          .filter((entry) => entry.type === "full")
          .map((entry) => Number(entry.timestamp?.stop || 0)),
      );
      return `wemove_last_backup_timestamp_seconds{repository="${repo}"} ${latest}\nwemove_last_full_backup_timestamp_seconds{repository="${repo}"} ${full}\n`;
    })
    .join("");
  return (
    "# HELP wemove_collector_up Database business metrics collection succeeded\n# TYPE wemove_collector_up gauge\nwemove_collector_up 1\n" +
    Object.entries(rows[0])
      .map(
        ([key, value]) =>
          `# TYPE wemove_${key} gauge\nwemove_${key} ${Number(value)}\n`,
      )
      .join("") +
    backupMetrics
  );
}
const server = http.createServer(async (req, res) => {
  if (!["/health", "/metrics"].includes(req.url)) {
    res.writeHead(404);
    return res.end();
  }
  try {
    if (Date.now() > expires) {
      pending ??= collect()
        .then((value) => {
          cache = value;
          expires = Date.now() + 15000;
        })
        .finally(() => {
          pending = null;
        });
      await pending;
    }
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
    res.end(req.url === "/health" ? "ok" : cache);
  } catch {
    res.writeHead(503);
    res.end("wemove_collector_up 0\n");
  }
});
server.listen(Number(process.env.METRICS_PORT || 9108), "0.0.0.0");
process.on("SIGTERM", () =>
  server.close(() => {
    void prisma.$disconnect();
  }),
);
