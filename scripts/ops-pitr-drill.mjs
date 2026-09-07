import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { args, command, sql } from "./ops-backup-lib.mjs";

// Real pgBackRest/WAL recovery on fresh Docker volumes; no existing database is used.
const options = args();
const image = options.image;
if (!image)
  throw new Error("Pass --image for an already built WEMOVE PostgreSQL image");
const id = Date.now().toString(),
  source = `wemove_pitr_source_${id}`,
  restored = `wemove_pitr_restored_${id}`;
const sourceVolume = `wemove_pitr_data_${id}`,
  backupVolume = `wemove_pitr_backup_${id}`,
  restoredVolume = `wemove_restore_pitr_${id}`;
process.env.PGBACKREST_CIPHER_PASS = randomBytes(32).toString("hex");
process.env.POSTGRES_PASSWORD = randomBytes(32).toString("hex");
const db = { container: source, database: "wemove", user: "wemove" };
const report = {
  startedAt: new Date().toISOString(),
  image,
  source,
  restored,
  sourceVolume,
  backupVolume,
  restoredVolume,
  passed: false,
};
const created = [];
async function ready(container) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if (
        (
          await command("docker", [
            "exec",
            container,
            "pg_isready",
            "-U",
            "wemove",
            "-d",
            "wemove",
          ])
        ).includes("accepting connections")
      )
        return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`PostgreSQL did not become ready: ${container}`);
}
try {
  for (const volume of [sourceVolume, backupVolume])
    await command("docker", [
      "volume",
      "create",
      "--label",
      "wemove.drill=pitr",
      volume,
    ]);
  await command("docker", [
    "run",
    "-d",
    "--name",
    source,
    "--network",
    "none",
    "--label",
    "wemove.drill=pitr",
    "-e",
    "POSTGRES_USER=wemove",
    "-e",
    "POSTGRES_DB=wemove",
    "-e",
    "POSTGRES_PASSWORD",
    "-e",
    "PGBACKREST_CIPHER_PASS",
    "-v",
    `${sourceVolume}:/var/lib/postgresql/data`,
    "-v",
    `${backupVolume}:/var/lib/pgbackrest`,
    image,
    "postgres",
    "-c",
    "wal_level=replica",
    "-c",
    "archive_mode=on",
    "-c",
    "archive_timeout=30",
    "-c",
    "archive_command=pgbackrest --stanza=wemove archive-push %p",
  ]);
  created.push(source);
  await ready(source);
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      await command("docker", [
        "exec",
        source,
        "test",
        "-f",
        "/var/lib/pgbackrest/.stanza-ready",
      ]);
      break;
    } catch {
      if (attempt === 89)
        throw new Error("pgBackRest stanza/check did not complete");
      await delay(1000);
    }
  }
  await sql(
    db,
    "CREATE TABLE recovery_markers (name text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT clock_timestamp()); INSERT INTO recovery_markers(name) VALUES ('baseline');",
  );
  await command("docker", [
    "exec",
    "--user",
    "postgres",
    source,
    "pgbackrest",
    "--stanza=wemove",
    "--type=full",
    "backup",
  ]);
  await sql(db, "INSERT INTO recovery_markers(name) VALUES ('before-target');");
  await command("docker", [
    "exec",
    "--user",
    "postgres",
    source,
    "pgbackrest",
    "--stanza=wemove",
    "--type=diff",
    "backup",
  ]);
  await delay(1200);
  const target = await sql(
    db,
    "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');",
  );
  report.target = target;
  await delay(1200);
  await sql(
    db,
    "INSERT INTO recovery_markers(name) VALUES ('after-target'); SELECT pg_switch_wal();",
  );
  await command("docker", [
    "exec",
    "--user",
    "postgres",
    source,
    "pgbackrest",
    "--stanza=wemove",
    "check",
  ]);
  report.sourceMarkers = JSON.parse(
    await sql(
      db,
      "SELECT json_agg(name ORDER BY created_at)::text FROM recovery_markers;",
    ),
  );
  const prepared = await command(process.execPath, [
    "scripts/ops-pitr-restore.mjs",
    "--backup-volume",
    backupVolume,
    "--target-volume",
    restoredVolume,
    "--image",
    image,
    "--time",
    target,
  ]);
  report.prepared = JSON.parse(prepared);
  await command("docker", [
    "run",
    "-d",
    "--name",
    restored,
    "--network",
    "none",
    "--label",
    "wemove.drill=pitr",
    "-e",
    "POSTGRES_USER=wemove",
    "-e",
    "POSTGRES_DB=wemove",
    "-e",
    "POSTGRES_PASSWORD",
    "-e",
    "PGBACKREST_CIPHER_PASS",
    "-e",
    "PGBACKREST_SKIP_INIT=true",
    "-e",
    "PGBACKREST_REPOSITORY_READONLY=true",
    "-v",
    `${restoredVolume}:/var/lib/postgresql/data`,
    "-v",
    `${backupVolume}:/var/lib/pgbackrest:ro`,
    image,
    "postgres",
    "-c",
    "archive_mode=off",
  ]);
  created.push(restored);
  await ready(restored);
  report.restoredMarkers = JSON.parse(
    await sql(
      { ...db, container: restored },
      "SELECT json_agg(name ORDER BY created_at)::text FROM recovery_markers;",
    ),
  );
  report.inRecovery = await sql(
    { ...db, container: restored },
    "SELECT pg_is_in_recovery();",
  );
  if (
    JSON.stringify(report.sourceMarkers) !==
      JSON.stringify(["baseline", "before-target", "after-target"]) ||
    JSON.stringify(report.restoredMarkers) !==
      JSON.stringify(["baseline", "before-target"]) ||
    report.inRecovery !== "f"
  )
    throw new Error("PITR marker or promotion verification failed");
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const container of created)
    await command("docker", ["stop", "--time", "15", container]).catch(
      () => {},
    );
  report.finishedAt = new Date().toISOString();
  report.containersStopped = true;
  report.volumesRetained = true;
  report.note =
    "Random drill passphrases are not retained. These isolated data volumes are evidence, not reusable production backups. No existing container or volume was modified.";
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/ops-pitr-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
