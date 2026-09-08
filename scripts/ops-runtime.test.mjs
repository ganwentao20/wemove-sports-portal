import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { command } from "./ops-backup-lib.mjs";
import {
  assertRuntimeCompose,
  runtimeComposeEnv,
  runtimeRedactor,
} from "./ops-runtime-lib.mjs";

const source = await readFile("infra/production/compose.yml", "utf8");
const settings = {
  COMPOSE_PROJECT_NAME: "wemove-isolation-test",
  IMAGE_PREFIX: "wemove",
  RELEASE: "test",
  DOMAIN: "example.invalid",
  TLS_EMAIL: "ops@example.invalid",
  POSTGRES_DB: "wemove",
  POSTGRES_USER: "wemove",
  POSTGRES_PASSWORD: "disposable-test-password",
  DATABASE_URL:
    "postgresql://wemove:disposable-test-password@postgres:5432/wemove",
  REDIS_PASSWORD: "disposable-redis-password",
  JWT_ACCESS_SECRET: "disposable-jwt-at-least-32-characters",
  MEDIA_SIGNING_SECRET: "disposable-media-secret",
  NOTIFICATION_ENCRYPTION_KEY: "disposable-outbox-key",
  MEDIA_SCAN_TOKEN: "disposable-scanner-token",
  PGBACKREST_CIPHER_PASS: "disposable-backup-passphrase",
  SMTP_HOST: "mail.example.invalid",
  EMAIL_FROM: "noreply@example.invalid",
};
const ambient = {
  ...process.env,
  DATABASE_URL: "postgresql://ci:ambient-password@localhost:5432/ci",
  JWT_ACCESS_SECRET: "ci-short-jwt",
  SMTP_HOST: "unintended.example.invalid",
  SMTP_PASS: "unintended-smtp-password",
  PAYMENT_PROVIDER_URL: "https://unintended.example.invalid/pay",
  B2B_PAYMENT_CREATE_URL: "https://unintended.example.invalid/b2b",
  PGBACKREST_S3_BUCKET: "unintended-bucket",
  PGBACKREST_S3_KEY_SECRET: "unintended-cloud-key",
  COMPOSE_PROFILES: "monitoring",
  COMPOSE_FILE: "unintended-compose.yml",
  IMAGE_PREFIX: "unintended-images",
  RELEASE: "unintended-release",
};

test("runtime environment preserves execution settings and removes every inherited Compose input", async () => {
  const env = runtimeComposeEnv(settings, source, ambient);
  for (const [, name] of source.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g))
    assert.equal(env[name], settings[name], name);
  assert.equal(env.COMPOSE_FILE, undefined);
  assert.equal(env.COMPOSE_PROFILES, undefined);
  assert.equal(env.Path ?? env.PATH, ambient.Path ?? ambient.PATH);
  assert.equal(ambient.DATABASE_URL.includes("localhost"), true);
  const childDb = await command(
    process.execPath,
    ["-e", "process.stdout.write(process.env.DATABASE_URL)"],
    undefined,
    { env },
  );
  assert.equal(childDb, settings.DATABASE_URL);
});

test("diagnostics redact generated, ambient and URL-encoded credentials", () => {
  const redact = runtimeRedactor(settings, ambient);
  const sample = `${settings.DATABASE_URL}\n${settings.POSTGRES_PASSWORD}\n${ambient.SMTP_PASS}\n${encodeURIComponent(ambient.PGBACKREST_S3_KEY_SECRET)}\npostgresql://unknown:password@db:5432/test\nP1001: localhost:5432 unavailable`;
  const safe = redact(sample);
  for (const value of [
    settings.DATABASE_URL,
    settings.POSTGRES_PASSWORD,
    ambient.SMTP_PASS,
    ambient.PGBACKREST_S3_KEY_SECRET,
    "unknown:password",
  ])
    assert.equal(safe.includes(value), false);
  assert.match(safe, /P1001: localhost:5432 unavailable/);
});

test("real Compose shell precedence is reproduced and isolated config rejects external resources", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "wemove-compose-test-"),
  );
  const envFile = path.join(directory, "runtime.env");
  try {
    await writeFile(
      envFile,
      Object.entries(settings)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
    const argv = [
      "compose",
      "--env-file",
      envFile,
      "-f",
      path.resolve("infra/production/compose.yml"),
      "-f",
      "-",
      "-p",
      settings.COMPOSE_PROJECT_NAME,
      "config",
      "--format",
      "json",
    ];
    const override =
      'services:\n  api:\n    environment:\n      NOTIFICATION_WORKER: "false"\n      MEDIA_CLEANUP_WORKER: "false"\n      B2B_REFUND_WORKER: "false"\n      RETENTION_WORKER: "false"\n';
    const before = JSON.parse(
      await command("docker", argv, override, { env: ambient }),
    );
    assert.equal(
      before.services.migrate.environment.DATABASE_URL,
      ambient.DATABASE_URL,
    );
    assert.throws(
      () => assertRuntimeCompose(before, settings),
      /unintended database/,
    );
    const after = JSON.parse(
      await command("docker", argv, override, {
        env: runtimeComposeEnv(settings, source, ambient),
      }),
    );
    assertRuntimeCompose(after, settings);
    assert.equal(after.services.api.environment.SMTP_PASS, "");
    assert.equal(
      after.services.postgres.environment.PGBACKREST_S3_KEY_SECRET,
      "",
    );
  } finally {
    await unlink(envFile).catch(() => {});
    await rmdir(directory);
  }
});
