import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { args, backup, restore } from "./ops-backup-lib.mjs";
try {
  const options = args();
  if (!options.container || !options.database || !options.user)
    throw new Error(
      "Pass the isolated source --container, --database and --user",
    );
  process.env.OPS_BACKUP_KEY = randomBytes(32).toString("base64");
  const stamp = Date.now();
  const output = `.local/ops-drill-${stamp}`;
  const copied = await backup({
    ...options,
    output,
    "database-only": true,
    revision: process.env.GITHUB_SHA || "local-integrated-worktree",
  });
  const restored = await restore({
    ...options,
    input: output,
    database: `wemove_restore_${stamp}`,
  });
  const report = {
    timestamp: new Date().toISOString(),
    ...copied,
    ...restored,
    encryption: "AES-256-GCM; HMAC-SHA256 manifest; SHA256 ciphertext",
    productionDatabaseChanged: false,
  };
  await writeFile(
    ".local/ops-restore-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
