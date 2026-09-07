import { args, command } from "./ops-backup-lib.mjs";
try {
  const options = args();
  const target = options["target-volume"];
  if (!/^wemove_restore_[a-z0-9_]+$/.test(target || ""))
    throw new Error("PITR only restores to a new wemove_restore_ volume");
  if (
    !options["backup-volume"] ||
    !options.image ||
    !options.time ||
    !Number.isFinite(Date.parse(options.time)) ||
    !/Z$/.test(options.time)
  )
    throw new Error(
      "Use --backup-volume, --image and --time in ISO UTC ending Z",
    );
  if (!process.env.PGBACKREST_CIPHER_PASS)
    throw new Error(
      "Set PGBACKREST_CIPHER_PASS without passing it on the command line",
    );
  const volumes = (
    await command("docker", ["volume", "ls", "--format", "{{.Name}}"])
  ).split("\n");
  if (!volumes.includes(options["backup-volume"]))
    throw new Error("Source backup volume does not exist");
  if (volumes.includes(target))
    throw new Error("Target volume already exists; no data was changed");
  await command("docker", ["volume", "create", target]);
  await command("docker", [
    "run",
    "--rm",
    "--network",
    "none",
    "-e",
    "PGBACKREST_CIPHER_PASS",
    "-e",
    "PGBACKREST_REPOSITORY_READONLY=true",
    "-v",
    `${options["backup-volume"]}:/var/lib/pgbackrest:ro`,
    "-v",
    `${target}:/var/lib/postgresql/data`,
    options.image,
    "pgbackrest",
    "--stanza=wemove",
    "--repo=1",
    "--type=time",
    `--target=${new Date(options.time).toISOString().replace("T", " ").replace("Z", "+00")}`,
    "--target-action=promote",
    "restore",
  ]);
  console.log(
    JSON.stringify({
      restoredVolume: target,
      recoveryTarget: options.time,
      started: false,
      next: "Start an isolated PostgreSQL instance with this volume and the same read-only backup repository and passphrase. It will replay archived WAL and promote at the requested target. Verify before switching application traffic.",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
