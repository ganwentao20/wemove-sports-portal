import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { args, backup, command, restore } from "./ops-backup-lib.mjs";

// Starts the actual production Compose services on a new project. No published
// ports, real SMTP, public DNS/TLS request, existing database or project is used.
const options = args();
if (!options.release || !/^[a-zA-Z0-9_.-]+$/.test(options.release))
  throw new Error(
    "Pass --release for the already built API/Web/migrate/PostgreSQL/scanner image set",
  );
const project = `wemove-runtime-${Date.now()}`,
  prefix = String(options.prefix || "wemove");
if (!/^[a-zA-Z0-9_.\/-]+$/.test(prefix)) throw new Error("Invalid --prefix");
const directory = path.resolve(".local", project),
  envPath = path.join(directory, "runtime.env"),
  overridePath = path.join(directory, "override.yml");
const report = {
  startedAt: new Date().toISOString(),
  project,
  release: options.release,
  prefix,
  passed: false,
};
const secret = () => randomBytes(32).toString("hex"),
  pg = secret();
const settings = {
  COMPOSE_PROJECT_NAME: project,
  IMAGE_PREFIX: prefix,
  RELEASE: options.release,
  DOMAIN: "example.invalid",
  TLS_EMAIL: "ops@example.invalid",
  POSTGRES_DB: "wemove",
  POSTGRES_USER: "wemove",
  POSTGRES_PASSWORD: pg,
  DATABASE_URL: `postgresql://wemove:${pg}@postgres:5432/wemove?schema=public`,
  REDIS_PASSWORD: secret(),
  JWT_ACCESS_SECRET: secret(),
  MEDIA_SIGNING_SECRET: secret(),
  NOTIFICATION_ENCRYPTION_KEY: secret(),
  MEDIA_SCAN_TOKEN: secret(),
  PGBACKREST_CIPHER_PASS: secret(),
  SMTP_HOST: "mail.example.invalid",
  EMAIL_FROM: "WEMOVE <noreply@example.invalid>",
};
const compose = [
  "compose",
  "--env-file",
  envPath,
  "-f",
  path.resolve("infra/production/compose.yml"),
  "-f",
  overridePath,
  "-p",
  project,
];
const call = (...argv) => command("docker", [...compose, ...argv]);
const errorText = (error) =>
  [
    pg,
    ...Object.entries(settings)
      .filter(([key]) =>
        /PASSWORD|SECRET|TOKEN|KEY|PASS|DATABASE_URL/.test(key),
      )
      .map(([, value]) => value),
  ]
    .filter(Boolean)
    .reduce(
      (message, value) => message.replaceAll(value, "[redacted]"),
      String(error?.message || error),
    );
let initialized = false;
try {
  await mkdir(directory, { recursive: true });
  await writeFile(
    envPath,
    Object.entries(settings)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  await writeFile(
    overridePath,
    'services:\n  api:\n    environment:\n      NOTIFICATION_WORKER: "false"\n      MEDIA_CLEANUP_WORKER: "false"\n      B2B_REFUND_WORKER: "false"\n      RETENTION_WORKER: "false"\n',
  );
  await call("config", "--quiet");
  const existing = (
    await command("docker", [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.ID}}",
    ])
  ).trim();
  if (existing)
    throw new Error(
      "Generated project unexpectedly exists; refusing to reuse it",
    );
  initialized = true;
  console.log(
    "Starting isolated production PostgreSQL, Redis, migration, ClamAV, scanner, API and Web.",
  );
  await call("up", "-d", "--no-build", "web");
  async function probe(service, url, expected = 200) {
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const result = JSON.parse(
          await call(
            "exec",
            "-T",
            service,
            "node",
            "--input-type=module",
            "-e",
            `const r=await fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(5000)});const text=await r.text();console.log(JSON.stringify({status:r.status,type:r.headers.get('content-type'),text}));`,
          ),
        );
        if (result.status === expected) return result;
      } catch {}
      await delay(1000);
    }
    throw new Error(`${service} did not return ${expected} at ${url}`);
  }
  const ready = await probe("api", "http://127.0.0.1:8080/api/v1/health/ready");
  report.readiness = {
    status: ready.status,
    data: JSON.parse(ready.text).data,
  };
  const home = await probe("web", "http://127.0.0.1:3000/en/products");
  if (!home.type?.includes("text/html") || !home.text.includes("<main"))
    throw new Error(
      "Production storefront did not render HTML with a main landmark",
    );
  report.storefront = { status: home.status, html: true, main: true };
  const proxy = await probe("web", "http://127.0.0.1:3000/api/v1/products");
  if (JSON.parse(proxy.text).code !== 0)
    throw new Error(
      "Same-origin product proxy returned an invalid API envelope",
    );
  report.sameOriginProxy = { status: proxy.status, code: 0 };
  const config = await probe("web", "http://127.0.0.1:3000/api/v1/site/config");
  if (JSON.parse(config.text).code !== 0)
    throw new Error("Configuration proxy failed");
  report.siteConfigProxy = config.status;
  const secure = await probe(
    "web",
    "http://127.0.0.1:3000/api/secure/customer/account/profile",
    401,
  );
  report.unauthenticatedSecureProxy = secure.status;
  report.migrations = Number(
    await call(
      "exec",
      "-T",
      "postgres",
      "psql",
      "-XqAt",
      "-U",
      "wemove",
      "-d",
      "wemove",
      "-c",
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;',
    ),
  );
  // Exercise the same quiesced database + media backup used in operations. This
  // synthetic file and both recovery targets exist only in this new project.
  const evidence = randomBytes(4096);
  await call(
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    `require('node:fs').writeFileSync('/app/apps/api/media_private/runtime-drill-proof.bin',Buffer.from('${evidence.toString("base64")}', 'base64'));`,
  );
  const apiContainer = (await call("ps", "-q", "api")).trim();
  const postgresContainer = (await call("ps", "-q", "postgres")).trim();
  const restoreId = Date.now();
  const mediaVolume = `wemove_restore_runtime_${restoreId}`;
  const previousBackupKey = process.env.OPS_BACKUP_KEY;
  process.env.OPS_BACKUP_KEY = randomBytes(32).toString("base64");
  try {
    const result = await backup({
      container: postgresContainer,
      database: "wemove",
      user: "wemove",
      project,
      quiesce: apiContainer,
      "media-container": apiContainer,
      "tar-image": `${prefix}-postgres:${options.release}`,
      output: path.join(directory, "full-backup"),
      revision: options.release,
    });
    const recovered = await restore({
      container: postgresContainer,
      database: `wemove_restore_runtime_${restoreId}`,
      user: "wemove",
      input: result.directory,
      "media-volume": mediaVolume,
      "tar-image": `${prefix}-postgres:${options.release}`,
    });
    const restoredHash = await command("docker", [
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "node",
      "-v",
      `${mediaVolume}:/restore:ro`,
      `${prefix}-api:${options.release}`,
      "-e",
      "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('/restore/runtime-drill-proof.bin')).digest('hex'))",
    ]);
    if (restoredHash !== createHash("sha256").update(evidence).digest("hex"))
      throw new Error("Restored media bytes differ from the synthetic source");
    report.fullBackupRestore = {
      ...recovered,
      scope: result.scope,
      mediaVolume,
      mediaBytesVerified: true,
      restoredFileSize: evidence.length,
      applicationResumed: false,
    };
    await probe("api", "http://127.0.0.1:8080/api/v1/health/ready");
    report.fullBackupRestore.applicationResumed = true;
  } finally {
    if (previousBackupKey === undefined) delete process.env.OPS_BACKUP_KEY;
    else process.env.OPS_BACKUP_KEY = previousBackupKey;
  }
  report.images = JSON.parse(await call("images", "--format", "json"));
  report.passed = true;
} catch (error) {
  report.error = errorText(error);
  process.exitCode = 1;
} finally {
  if (initialized) {
    try {
      await call("stop", "--timeout", "15");
      report.containersStopped = true;
    } catch (error) {
      report.stopError = errorText(error);
      report.passed = false;
      process.exitCode = 1;
    }
  }
  await unlink(envPath).catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.volumesRetained = true;
  report.note =
    "Only a fresh generated Compose project was used. No ports were published, email workers were disabled, temporary credentials are excluded from this report and the temporary environment file was removed. No existing business data was used.";
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/ops-runtime-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
