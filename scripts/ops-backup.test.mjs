import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import {
  args,
  sealManifest,
  openManifest,
  encryptStream,
  verifyArtifacts,
  decryptTo,
  restore,
} from "./ops-backup-lib.mjs";
test("backup authenticates encrypted binary content and detects tampered metadata or ciphertext", async () => {
  const key = randomBytes(32);
  const source = randomBytes(2048);
  const directory = await mkdtemp(path.join(tmpdir(), "wemove-backup-test-"));
  const artifact = await encryptStream(
    Readable.from(source),
    path.join(directory, "database.dump.enc"),
    key,
  );
  const manifest = { version: 1, artifacts: [artifact], counts: { test: 4 } };
  const envelope = sealManifest(manifest, key);
  assert.deepEqual(openManifest(envelope, key), manifest);
  assert.throws(
    () => openManifest(envelope, randomBytes(32)),
    /authentication failed/,
  );
  assert.throws(
    () => openManifest(envelope.replace("test", "altered"), key),
    /authentication failed/,
  );
  await verifyArtifacts(directory, manifest);
  const chunks = [];
  await decryptTo(
    directory,
    artifact,
    key,
    new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    }),
  );
  assert.deepEqual(Buffer.concat(chunks), source);
  const content = await readFile(path.join(directory, artifact.file));
  content[4] ^= 1;
  await writeFile(path.join(directory, artifact.file), content);
  await assert.rejects(
    verifyArtifacts(directory, manifest),
    /Corrupt artifact/,
  );
});
test("restore refuses application database names before any Docker operation", async () => {
  process.env.OPS_BACKUP_KEY = randomBytes(32).toString("base64");
  await assert.rejects(
    restore({ database: "wemove", input: "." }),
    /only creates a new database/,
  );
  assert.deepEqual(args(["--database-only", "--database", "test"]), {
    "database-only": true,
    database: "test",
  });
});
