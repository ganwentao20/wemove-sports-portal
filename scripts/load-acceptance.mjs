import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import os from "node:os";

// Bounded classroom capacity check against an explicitly local API only.
const origin = new URL(process.env.LOAD_BASE_URL || "http://127.0.0.1:8080");
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("Load acceptance is restricted to a local test environment.");
const mode = process.argv[2] || "public";
if (!["public", "mixed"].includes(mode))
  throw new Error("Use public or mixed.");
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || 60);
if (
  !Number.isInteger(durationSeconds) ||
  durationSeconds < 10 ||
  durationSeconds > 300
)
  throw new Error("Duration must be 10–300 seconds.");
const concurrency = 100;
const paths = [
  "/products?pageSize=20&market=US",
  "/products/ring-toss-outdoor-game-set?market=US",
  "/search?q=bowling&market=US",
  "/cms/pages?kind=ARTICLE&market=US",
  "/site/config",
];
const tokens = [];
if (mode === "mixed") {
  for (let i = 0; i < 10; i++) {
    const response = await fetch(new URL("/api/v1/auth/login", origin), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: process.env.LOAD_EMAIL || "customer@wemove.local",
        password: process.env.LOAD_PASSWORD || "Demo1234",
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    const token = body.data?.accessToken;
    if (!response.ok || !token)
      throw new Error(
        `Login setup failed (${response.status}); no capacity conclusion.`,
      );
    tokens.push(token);
  }
}
for (const route of paths) {
  const response = await fetch(new URL("/api/v1" + route, origin));
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Warmup failed: ${response.status}`);
}
const samples = [],
  started = new Date().toISOString(),
  begin = performance.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await Promise.all(
  Array.from({ length: concurrency }, async (_, user) => {
    const authenticated = mode === "mixed" && user < 10;
    for (let round = 0; round < durationSeconds; round++) {
      await sleep(Math.max(0, begin + round * 1000 - performance.now()));
      const route = authenticated
        ? "/auth/me"
        : paths[(user + round) % paths.length];
      const start = performance.now();
      let status = 0;
      try {
        const response = await fetch(new URL("/api/v1" + route, origin), {
          headers: authenticated
            ? { authorization: "Bearer " + tokens[user] }
            : {},
          signal: AbortSignal.timeout(10000),
        });
        await response.arrayBuffer();
        status = response.status;
      } catch {
        /* Transport failures remain status 0 in the evidence. */
      }
      samples.push({
        group: authenticated ? "authenticated" : "public",
        route,
        status,
        milliseconds: performance.now() - start,
      });
    }
  }),
);
const elapsedSeconds = (performance.now() - begin) / 1000;
function summarize(rows) {
  const durations = rows.map((x) => x.milliseconds).sort((a, b) => a - b);
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  const errors = rows.filter((x) => x.status !== 200).length;
  return {
    requests: rows.length,
    statuses: counts,
    p95Ms: durations[Math.ceil(rows.length * 0.95) - 1] ?? null,
    errorRate: rows.length ? errors / rows.length : 0,
    rateLimited: counts[429] || 0,
  };
}
const total = summarize(samples);
const report = {
  started,
  mode,
  concurrency,
  durationSeconds,
  elapsedSeconds,
  pacing:
    "100 virtual users, one request per user per second; full response body timed",
  loginSetup:
    mode === "mixed"
      ? "10 separate sessions of the seeded customer; 90 public users + 10 authenticated users, not 10% repeated password hashing"
      : "none",
  environment: {
    platform: os.platform(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
    node: process.version,
    api: origin.origin,
  },
  total,
  public: summarize(samples.filter((x) => x.group === "public")),
  authenticated: summarize(samples.filter((x) => x.group === "authenticated")),
  passed: total.errorRate === 0 && total.p95Ms < 500,
  samples,
};
await mkdir(".local/report-final", { recursive: true });
await writeFile(
  `.local/report-final/load-${mode}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    { mode, elapsedSeconds, total, passed: report.passed },
    null,
    2,
  ),
);
if (!report.passed) process.exitCode = 1;
