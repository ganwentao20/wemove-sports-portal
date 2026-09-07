import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import path from "node:path";

export function args(argv = process.argv.slice(2)) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error("Use --name value options");
    const name = argv[i].slice(2);
    values[name] =
      argv[i + 1]?.startsWith("--") || i + 1 === argv.length ? true : argv[++i];
  }
  return values;
}
export function backupKey() {
  const key = Buffer.from(process.env.OPS_BACKUP_KEY || "", "base64");
  if (key.length !== 32)
    throw new Error("OPS_BACKUP_KEY must be a base64 encoded 32-byte key");
  return key;
}
export function child(command, argv, { input = "pipe", env } = {}) {
  const process = spawn(command, argv, {
    stdio: [input, "pipe", "pipe"],
    windowsHide: true,
    ...(env ? { env } : {}),
  });
  let stderr = "";
  process.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-3000);
  });
  const done = new Promise((resolve, reject) => {
    process.once("error", reject);
    process.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited ${code}: ${stderr}`)),
    );
  });
  // Callers await this after streaming; attach a handler immediately to avoid early unhandled rejection.
  done.catch(() => {});
  return { process, done };
}
export async function command(name, argv, input, options) {
  const { process, done } = child(name, argv, options);
  let output = "";
  process.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  process.stdin.end(input);
  await done;
  return output.trim();
}
export function dbArgs(options, database = options.database) {
  for (const key of ["container", "user"])
    if (!options[key] || !/^[A-Za-z0-9_.-]+$/.test(options[key]))
      throw new Error(`Invalid --${key}`);
  if (!database || !/^[A-Za-z0-9_]+$/.test(database))
    throw new Error("Database name must be alphanumeric with underscores");
  return [
    "exec",
    "-i",
    options.container,
    "psql",
    "-XqAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    options.user,
    "-d",
    database,
  ];
}
export async function sql(options, query, database = options.database) {
  return command("docker", dbArgs(options, database), query);
}
export async function snapshot(options) {
  const run = child("docker", dbArgs(options));
  const lines = createInterface({ input: run.process.stdout });
  run.process.stdin.write(
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n",
  );
  const id = await Promise.race([
    new Promise((resolve) => lines.once("line", resolve)),
    run.done.then(() => {
      throw new Error("Snapshot transaction closed early");
    }),
  ]);
  if (!/^[0-9A-Fa-f-]+$/.test(id)) throw new Error("Invalid database snapshot");
  return {
    id,
    close: async () => {
      run.process.stdin.end("ROLLBACK;\n");
      await run.done;
      lines.close();
    },
  };
}
export const countsSql = `SELECT coalesce(json_object_agg(relname, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', relname),false,true,'')))[1]::text::bigint),'{}'::json)::text FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='public' AND relkind IN ('r','p');`;
export async function encryptStream(readable, file, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const hash = createHash("sha256");
  const digest = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    readable,
    cipher,
    digest,
    createWriteStream(file, { flags: "wx", mode: 0o600 }),
  );
  return {
    file: path.basename(file),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    sha256: hash.digest("hex"),
  };
}
export function sealManifest(manifest, key) {
  const data = JSON.stringify(manifest);
  const signature = createHmac("sha256", key)
    .update("wemove-backup-v1\0")
    .update(data)
    .digest("hex");
  return JSON.stringify({ data, signature }, null, 2);
}
export function openManifest(text, key) {
  const envelope = JSON.parse(text);
  const expected = createHmac("sha256", key)
    .update("wemove-backup-v1\0")
    .update(envelope.data)
    .digest();
  const actual = Buffer.from(envelope.signature || "", "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Backup manifest authentication failed");
  const manifest = JSON.parse(envelope.data);
  if (manifest.version !== 1 || !Array.isArray(manifest.artifacts))
    throw new Error("Unsupported backup format");
  for (const item of manifest.artifacts)
    if (!["database.dump.enc", "media.tar.enc"].includes(item.file))
      throw new Error("Invalid artifact path");
  return manifest;
}
export async function verifyArtifacts(directory, manifest) {
  for (const item of manifest.artifacts) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path.join(directory, item.file)))
      hash.update(chunk);
    if (hash.digest("hex") !== item.sha256)
      throw new Error(`Corrupt artifact: ${item.file}`);
  }
}
export async function decryptTo(directory, artifact, key, writable) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(artifact.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(artifact.tag, "base64"));
  await pipeline(
    createReadStream(path.join(directory, artifact.file)),
    decipher,
    writable,
  );
}
export async function backup(options) {
  const key = backupKey();
  dbArgs(options);
  if (!options.output) throw new Error("--output is required");
  const directory = path.resolve(options.output);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const paused = [];
  let transaction;
  try {
    if (!options["database-only"]) {
      if (!options.project || !options.quiesce || !options["media-container"])
        throw new Error(
          "Full backup requires --project, --quiesce api-container[,another-api], and --media-container",
        );
      const all = [
        ...new Set([
          options.container,
          options["media-container"],
          ...options.quiesce.split(","),
        ]),
      ];
      for (const name of all) {
        const inspected = JSON.parse(
          await command("docker", ["inspect", name]),
        )[0];
        if (
          inspected.Config.Labels?.["com.docker.compose.project"] !==
          options.project
        )
          throw new Error(
            "Container project does not match explicit backup project",
          );
      }
      // Archive media through a temporary reader while all mutating application workers are stopped.
      for (const name of options.quiesce.split(",")) {
        const state = await command("docker", [
          "inspect",
          "--format",
          "{{.State.Running}}",
          name,
        ]);
        if (state === "true") {
          await command("docker", ["stop", "--time", "40", name]);
          paused.push(name);
        }
      }
    }
    transaction = await snapshot(options);
    const counts = JSON.parse(
      await sql(
        options,
        `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '${transaction.id}'; ${countsSql} COMMIT;`,
      ),
    );
    const dump = child(
      "docker",
      [
        "exec",
        options.container,
        "pg_dump",
        "-U",
        options.user,
        "-d",
        options.database,
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${transaction.id}`,
      ],
      { input: "ignore" },
    );
    const artifacts = [
      await encryptStream(
        dump.process.stdout,
        path.join(directory, "database.dump.enc"),
        key,
      ),
    ];
    await dump.done;
    if (!options["database-only"]) {
      const media = child(
        "docker",
        [
          "run",
          "--rm",
          "--network",
          "none",
          "--volumes-from",
          `${options["media-container"]}:ro`,
          options["tar-image"] || "postgres:16-alpine",
          "tar",
          "-C",
          "/app/apps/api/media_private",
          "-cf",
          "-",
          ".",
        ],
        { input: "ignore" },
      );
      artifacts.push(
        await encryptStream(
          media.process.stdout,
          path.join(directory, "media.tar.enc"),
          key,
        ),
      );
      await media.done;
    }
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: options.database,
      revision: options.revision || "unspecified",
      scope: options["database-only"] ? "database-only" : "database-and-media",
      counts,
      artifacts,
    };
    await writeFile(
      path.join(directory, "manifest.json"),
      sealManifest(manifest, key),
      { flag: "wx", mode: 0o600 },
    );
    return {
      directory,
      tables: Object.keys(counts).length,
      scope: manifest.scope,
    };
  } finally {
    try {
      await transaction?.close();
    } finally {
      for (const name of paused) await command("docker", ["start", name]);
    }
  }
}
export async function restore(options) {
  const key = backupKey();
  if (
    !options.input ||
    !/^wemove_restore_[a-z0-9_]+$/.test(options.database || "")
  )
    throw new Error(
      "Restore only creates a new database named wemove_restore_<suffix> and requires --input",
    );
  dbArgs(options);
  const directory = path.resolve(options.input);
  const manifest = openManifest(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
    key,
  );
  await verifyArtifacts(directory, manifest);
  if (
    await sql(
      options,
      `SELECT 1 FROM pg_database WHERE datname='${options.database}';`,
      "postgres",
    )
  )
    throw new Error("Restore target already exists; no database was changed");
  if (
    options["media-volume"] &&
    !/^wemove_restore_[a-z0-9_]+$/.test(options["media-volume"])
  )
    throw new Error("Media target must be a new wemove_restore_ volume");
  if (options["media-volume"]) {
    const volumes = (
      await command("docker", ["volume", "ls", "--format", "{{.Name}}"])
    ).split("\n");
    if (volumes.includes(options["media-volume"]))
      throw new Error("Media volume already exists; no database was changed");
  }
  await sql(
    options,
    `CREATE DATABASE "${options.database}" TEMPLATE template0;`,
    "postgres",
  );
  const operation = child("docker", [
    "exec",
    "-i",
    options.container,
    "pg_restore",
    "-U",
    options.user,
    "-d",
    options.database,
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-acl",
  ]);
  await decryptTo(
    directory,
    manifest.artifacts.find((item) => item.file === "database.dump.enc"),
    key,
    operation.process.stdin,
  );
  await operation.done;
  const restored = JSON.parse(await sql(options, countsSql));
  const canonical = (value) =>
    JSON.stringify(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
    );
  if (canonical(manifest.counts) !== canonical(restored))
    throw new Error(
      "Restored row counts differ; isolated restore database retained for investigation",
    );
  if (options["media-volume"]) {
    const media = manifest.artifacts.find(
      (item) => item.file === "media.tar.enc",
    );
    if (!media) throw new Error("Backup has no media artifact");
    await command("docker", ["volume", "create", options["media-volume"]]);
    const tar = child("docker", [
      "run",
      "--rm",
      "-i",
      "--network",
      "none",
      "-v",
      `${options["media-volume"]}:/restore`,
      options["tar-image"] || "postgres:16-alpine",
      "sh",
      "-c",
      "tar -C /restore -xf - && chown -R 1000:1000 /restore",
    ]);
    await decryptTo(directory, media, key, tar.process.stdin);
    await tar.done;
  }
  return {
    database: options.database,
    tables: Object.keys(restored).length,
    rowCountsVerified: true,
    mediaRestored: !!options["media-volume"],
  };
}
