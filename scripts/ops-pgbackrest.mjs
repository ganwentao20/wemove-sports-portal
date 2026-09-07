import { args, command } from "./ops-backup-lib.mjs";
import path from "node:path";
try {
  const options = args();
  const action = options.action;
  if (!["full", "diff", "check", "info"].includes(action))
    throw new Error("--action must be full, diff, check, or info");
  if (!options["env-file"] || !options.project)
    throw new Error("Explicit --env-file and --project are required");
  const repos = String(options.repos || "1").split(",");
  if (repos.some((repo) => !["1", "2"].includes(repo)))
    throw new Error("--repos must be 1 or 1,2");
  const compose = [
    "compose",
    "--env-file",
    path.resolve(options["env-file"]),
    "-f",
    path.resolve("infra/production/compose.yml"),
    "-p",
    options.project,
    "exec",
    "-T",
    "--user",
    "postgres",
    "postgres",
  ];
  for (const repo of repos) {
    const output = await command("docker", [
      ...compose,
      "pgbackrest",
      "--stanza=wemove",
      `--repo=${repo}`,
      ...(["full", "diff"].includes(action)
        ? [`--type=${action}`, "backup"]
        : [action]),
    ]);
    if (["full", "diff"].includes(action))
      await command("docker", [
        ...compose,
        "sh",
        "-c",
        "umask 022; pgbackrest --stanza=wemove --output=json info > /var/lib/pgbackrest-status/status.json",
      ]);
    if (output) console.log(output);
    console.log(`pgBackRest ${action} completed for repository ${repo}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
