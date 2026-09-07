// Compose gives the invoking shell priority over --env-file. A drill must never
// inherit production endpoints, credentials, image overrides or enabled profiles.
export function runtimeComposeEnv(
  settings,
  composeSource,
  inherited = process.env,
) {
  const variables = new Set(
    [...composeSource.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) =>
      match[1].toUpperCase(),
    ),
  );
  for (const key of Object.keys(settings)) variables.add(key.toUpperCase());
  return {
    ...Object.fromEntries(
      Object.entries(inherited).filter(
        ([key]) => !variables.has(key.toUpperCase()) && !/^COMPOSE_/i.test(key),
      ),
    ),
    ...settings,
  };
}

export function runtimeRedactor(...environments) {
  const values = [
    ...new Set(
      environments.flatMap((environment) =>
        Object.entries(environment)
          .filter(
            ([key, value]) =>
              /PASSWORD|SECRET|TOKEN|KEY|PASS|DATABASE_URL|REDIS_URL|SMTP_USER/i.test(
                key,
              ) &&
              typeof value === "string" &&
              value.length >= 4,
          )
          .flatMap(([, value]) => [value, encodeURIComponent(value)]),
      ),
    ),
  ].sort((a, b) => b.length - a.length);
  return (value) =>
    values
      .reduce(
        (message, secret) => message.replaceAll(secret, "[redacted]"),
        String(value?.message || value),
      )
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, "$1[redacted]@");
}

export function assertRuntimeCompose(config, settings) {
  const services = config.services || {};
  for (const service of ["api", "migrate"])
    if (services[service]?.environment?.DATABASE_URL !== settings.DATABASE_URL)
      throw new Error(
        `${service} inherited an unintended database configuration`,
      );
  const api = services.api.environment;
  if (
    api.JWT_ACCESS_SECRET !== settings.JWT_ACCESS_SECRET ||
    api.SMTP_HOST !== settings.SMTP_HOST ||
    api.PAYMENT_PROVIDER_URL ||
    api.B2B_PAYMENT_CREATE_URL ||
    services.postgres?.environment?.PGBACKREST_S3_BUCKET
  )
    throw new Error(
      "Production credentials or external resources leaked into the drill",
    );
  if (
    api.NOTIFICATION_WORKER !== "false" ||
    api.RETENTION_WORKER !== "false" ||
    api.MEDIA_CLEANUP_WORKER !== "false" ||
    api.B2B_REFUND_WORKER !== "false"
  )
    throw new Error("Isolated runtime workers must be disabled");
}
