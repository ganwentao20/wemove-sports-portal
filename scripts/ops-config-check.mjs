import { spawnSync } from "node:child_process";
// Syntactic validation uses generated disposable values, never a real .env.
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: "wemove-config-check",
  RELEASE: "validation",
  DOMAIN: "validation.example.invalid",
  TLS_EMAIL: "ops@example.invalid",
  POSTGRES_DB: "wemove",
  POSTGRES_USER: "wemove",
  POSTGRES_PASSWORD: "disposable-configuration-only",
  DATABASE_URL:
    "postgresql://wemove:disposable-configuration-only@postgres:5432/wemove",
  REDIS_PASSWORD: "disposable-configuration-only",
  JWT_ACCESS_SECRET: "disposable-configuration-secret-at-least-32-characters",
  MEDIA_SIGNING_SECRET: "disposable-media-secret-at-least-32-characters",
  MEDIA_SCAN_TOKEN: "disposable-scanner-secret-at-least-32-characters",
  NOTIFICATION_ENCRYPTION_KEY:
    "disposable-notifications-secret-at-least-32-characters",
  SMTP_HOST: "smtp.example.invalid",
  EMAIL_FROM: "validation@example.invalid",
  PGBACKREST_CIPHER_PASS: "disposable-backup-secret-at-least-32-characters",
};
const result = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    "infra/production/.env.example",
    "-f",
    "infra/production/compose.yml",
    "--profile",
    "monitoring",
    "config",
    "--quiet",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
